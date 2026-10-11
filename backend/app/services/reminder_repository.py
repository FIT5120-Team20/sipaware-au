"""Dedicated reminder metadata: versioned settings and a recoverable queue outbox.
Personal drinking records never cross this boundary. Queue publication happens
outside transactions; callbacks and clients can repair a committed pending intent.
"""
import hashlib
import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

import psycopg
from psycopg.rows import dict_row
from dotenv import dotenv_values

class ReminderUnavailable(RuntimeError):
    pass


def reminder_database_url():
    value = os.environ.get('REMINDER_DATABASE_URL', '').strip()
    if not value:
        value = str(dotenv_values(Path(__file__).resolve().parents[2] / '.env').get('REMINDER_DATABASE_URL') or '').strip()
    if not value:
        raise ReminderUnavailable('Reminder storage is not configured.')
    return value

@contextmanager
def connection():
    try:
        with psycopg.connect(reminder_database_url(), connect_timeout=5, row_factory=dict_row) as db:
            # Neon pooled endpoints reject startup options. Transaction-local
            # limits work with pooling and reset automatically when released.
            db.execute("SET LOCAL statement_timeout='5s'")
            db.execute("SET LOCAL lock_timeout='2s'")
            yield db
    except psycopg.Error:
        raise ReminderUnavailable('Reminder storage is unavailable.') from None


def identity(device_key: str) -> str:
    return hashlib.sha256(device_key.encode()).hexdigest()


class ReminderRepository:
    def __init__(self, publisher=None, canceller=None, clock=None):
        from app.services.reminder_queue import publish, cancel
        self.publish = publisher or publish
        self.cancel = canceller or cancel
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def save(self, token, value):
        # The retired preparation API has no revision. Keep it harmless when an
        # old cached client meets a newer, enabled subscription.
        return {'saved': False, 'enabled': False}

    def status(self, token):
        with connection() as db:
            row = db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s', (identity(token),)).fetchone()
        attention = bool(row and row['enabled'] and (row['queue_pending'] or not row['next_due_at']
                         or row['next_due_at'] < self.clock() - timedelta(minutes=15)))
        return {'saved': bool(row), 'enabled': bool(row and row['enabled'] and not attention),
                'needs_attention': attention, 'time': row['reminder_time'] if row else None,
                'timezone': row['timezone'] if row else None,
                'next_due_at': row['next_due_at'].isoformat() if row and row['next_due_at'] else None}

    def ensure_scheduled(self, device, generation=None):
        with connection() as db:
            row = db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s', (device,)).fetchone()
        if (not row or not row['enabled'] or not row['queue_pending'] or not row['next_due_at']
                or generation is not None and row['schedule_generation'] != generation):
            return
        message_id = self.publish(row)
        with connection() as db:
            db.execute("""UPDATE reminder_subscriptions SET queue_message_id=%s,queue_pending=false
              WHERE token_hash=%s AND enabled AND schedule_generation=%s AND next_due_at=%s AND queue_pending""",
              (message_id, device, row['schedule_generation'], row['next_due_at']))
            current = db.execute('SELECT queue_message_id FROM reminder_subscriptions WHERE token_hash=%s', (device,)).fetchone()
        # Concurrent retries may receive the SAME provider deduplication ID.
        # Cancel only a genuinely superseded publication, never the winning ID.
        if not current or current['queue_message_id'] != message_id:
            self.cancel(message_id)

    def disable(self, token, revision):
        device = identity(token)
        obsolete = None
        with connection() as db:
            row = db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE', (device,)).fetchone()
            obsolete = row['queue_message_id'] if row else None
            updated = db.execute("""INSERT INTO reminder_subscriptions
              (token_hash,enabled,revision,schedule_generation,queue_pending)
              VALUES (%s,false,%s,%s,false)
              ON CONFLICT(token_hash) DO UPDATE SET enabled=false,revision=EXCLUDED.revision,
              schedule_generation=EXCLUDED.schedule_generation,next_due_at=NULL,
              queue_message_id=NULL,queue_pending=false,updated_at=now()
              WHERE reminder_subscriptions.revision < EXCLUDED.revision RETURNING token_hash""",
              (device,revision,uuid4())).fetchone()
            if not updated:
                obsolete = None
        if obsolete:
            self.cancel(obsolete)
        return self.status(token)

    def enable(self, token, value):
        from app.services.reminder_time import next_due
        now = self.clock()
        if value.date != now.astimezone(ZoneInfo(value.timezone)).date():
            raise ReminderUnavailable('Current-day synchronization is required.')
        device, generation, obsolete = identity(token), uuid4(), None
        with connection() as db:
            row = db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE', (device,)).fetchone()
            if row and value.revision <= row['revision']:
                generation = row['schedule_generation']
            else:
                obsolete = row['queue_message_id'] if row else None
                db.execute("""INSERT INTO reminder_subscriptions
                  (token_hash,endpoint,p256dh,auth,reminder_time,timezone,enabled,revision,
                   checkin_date,checked_in,synced_at,schedule_generation,next_due_at,queue_pending)
                  VALUES (%s,%s,%s,%s,%s,%s,true,%s,%s,%s,now(),%s,%s,true)
                  ON CONFLICT(token_hash) DO UPDATE SET endpoint=EXCLUDED.endpoint,p256dh=EXCLUDED.p256dh,
                  auth=EXCLUDED.auth,reminder_time=EXCLUDED.reminder_time,timezone=EXCLUDED.timezone,
                  enabled=true,revision=EXCLUDED.revision,checkin_date=EXCLUDED.checkin_date,
                  checked_in=EXCLUDED.checked_in,synced_at=now(),updated_at=now(),
                  schedule_generation=EXCLUDED.schedule_generation,next_due_at=EXCLUDED.next_due_at,
                  queue_pending=true,queue_message_id=NULL
                  WHERE reminder_subscriptions.revision < EXCLUDED.revision""",
                  (device,value.endpoint,value.p256dh,value.auth,value.time,value.timezone,
                   value.revision,value.date,value.checked_in,generation,next_due(now,value.time,value.timezone)))
        if obsolete:
            self.cancel(obsolete)
        self.ensure_scheduled(device, generation)
        return self.status(token)

    def sync(self, token, value):
        device = identity(token)
        with connection() as db:
            row = db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE', (device,)).fetchone()
            if not row:
                raise ReminderUnavailable('Subscription unavailable.')
            if not row['enabled']:
                return {'synced': True}
            if value.date != self.clock().astimezone(ZoneInfo(row['timezone'])).date():
                raise ReminderUnavailable('Current date required.')
            db.execute("""UPDATE reminder_subscriptions SET checkin_date=%s,checked_in=%s,revision=%s,synced_at=now()
              WHERE token_hash=%s AND revision < %s""", (value.date,value.checked_in,value.revision,device,value.revision))
        self.ensure_scheduled(device)
        return {'synced': True}

    def advance_appointment(self, device, generation, due_at):
        """Persist the next local-day appointment before claiming today's push.

        Duplicate callbacks can repair its pending publication. A settings change
        rotates generation so queued callbacks from an older schedule are inert.
        """
        from app.services.reminder_time import next_due
        now = self.clock()
        with connection() as db:
            row = db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE', (device,)).fetchone()
            if (not row or not row['enabled'] or row['schedule_generation'] != generation
                    or not row['next_due_at'] or due_at > row['next_due_at']):
                return False
            if due_at > now:
                raise ReminderUnavailable('Appointment arrived before its due time.')
            if due_at == row['next_due_at']:
                db.execute("""UPDATE reminder_subscriptions SET next_due_at=%s,queue_pending=true,
                  queue_message_id=NULL WHERE token_hash=%s""", (next_due(now,row['reminder_time'],row['timezone']),device))
        self.ensure_scheduled(device, generation)
        return True
