"""Separate writable reminder storage; never use the reference DATABASE_URL."""
import hashlib
import os
from contextlib import contextmanager
from pathlib import Path

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
            yield db
    except psycopg.Error:
        raise ReminderUnavailable('Reminder storage is unavailable.') from None

def identity(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

class ReminderRepository:
    def save(self, token, value):
        with connection() as db:
            db.execute('''INSERT INTO reminder_subscriptions
                (token_hash, endpoint, p256dh, auth, reminder_time, timezone, enabled)
                VALUES (%s,%s,%s,%s,%s,%s,false)
                ON CONFLICT (token_hash) DO UPDATE SET endpoint=EXCLUDED.endpoint,
                p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth,
                reminder_time=EXCLUDED.reminder_time, timezone=EXCLUDED.timezone,
                enabled=false, updated_at=now()''',
                (identity(token), value.endpoint, value.p256dh, value.auth, value.time, value.timezone))
        # This preparation endpoint never pretends a scheduler is running.
        return {'saved': True, 'enabled': False}

    def status(self, token):
        with connection() as db:
            row = db.execute('SELECT reminder_time, timezone, enabled FROM reminder_subscriptions WHERE token_hash=%s', (identity(token),)).fetchone()
        return {'saved': bool(row), 'enabled': bool(row and row['enabled']),
                'time': row['reminder_time'] if row else None, 'timezone': row['timezone'] if row else None}

    def disable(self, token, revision=None):
        with connection() as db:
            db.execute('UPDATE reminder_subscriptions SET enabled=false, revision=GREATEST(revision+1,%s), updated_at=now() WHERE token_hash=%s', (revision or 0, identity(token)))
        return {'enabled': False}

    def enable(self, token, value):
        from datetime import datetime, timezone
        from zoneinfo import ZoneInfo
        today = datetime.now(timezone.utc).astimezone(ZoneInfo(value.timezone)).date()
        if value.date != today:
            raise ReminderUnavailable('Current-day synchronization is required.')
        with connection() as db:
            db.execute('''INSERT INTO reminder_subscriptions
              (token_hash,endpoint,p256dh,auth,reminder_time,timezone,enabled,revision,checkin_date,checked_in,synced_at)
              VALUES (%s,%s,%s,%s,%s,%s,true,%s,%s,%s,now())
              ON CONFLICT(token_hash) DO UPDATE SET endpoint=EXCLUDED.endpoint,p256dh=EXCLUDED.p256dh,
              auth=EXCLUDED.auth,reminder_time=EXCLUDED.reminder_time,timezone=EXCLUDED.timezone,
              enabled=true,revision=EXCLUDED.revision,checkin_date=EXCLUDED.checkin_date,
              checked_in=EXCLUDED.checked_in,synced_at=now(),updated_at=now()
              WHERE reminder_subscriptions.revision < EXCLUDED.revision''',
              (identity(token),value.endpoint,value.p256dh,value.auth,value.time,value.timezone,value.revision,value.date,value.checked_in))
        return self.status(token)

    def sync(self, token, value):
        from datetime import datetime, timezone
        from zoneinfo import ZoneInfo
        with connection() as db:
            row=db.execute('SELECT timezone FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE',(identity(token),)).fetchone()
            if not row: raise ReminderUnavailable('Subscription unavailable.')
            if value.date != datetime.now(timezone.utc).astimezone(ZoneInfo(row['timezone'])).date():
                raise ReminderUnavailable('Current date required.')
            db.execute('''UPDATE reminder_subscriptions SET checkin_date=%s,checked_in=%s,revision=%s,synced_at=now()
              WHERE token_hash=%s AND revision < %s''',(value.date,value.checked_in,value.revision,identity(token),value.revision))
        return {'synced':True}
