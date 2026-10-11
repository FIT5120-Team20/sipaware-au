"""One callback addresses one device and one version of its daily schedule.
Claims consume an attempt, even on uncertain outcomes; a deliberate time change
may claim again. Provider acceptance does not prove device display.
"""
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from app.services.reminder_repository import connection, ReminderRepository
from app.core.reminder_config import push_config

def eligible(row, now):
    local = now.astimezone(ZoneInfo(row['timezone']))
    completed_today = (row.get('checkin_date') == local.date()
                       and row.get('checked_in') is True)
    return (row['enabled'] and not completed_today
            and local.strftime('%H:%M') >= row['reminder_time'])

def send_push(row, config, day):
    from pywebpush import webpush, WebPushException
    try:
        webpush(subscription_info={'endpoint':row['endpoint'], 'keys':{'p256dh':row['p256dh'],'auth':row['auth']}},
            data=json.dumps({'type':'daily-check-in','date':str(day)}),
            vapid_private_key=config['REMINDER_VAPID_PRIVATE_KEY'],
            vapid_claims={'sub':config['REMINDER_VAPID_SUBJECT']}, ttl=300, timeout=8)
        return 'accepted'
    except WebPushException as exc:
        return 'expired' if exc.response is not None and exc.response.status_code in (404,410) else 'failed'
    except Exception:
        # Never log the exception: push errors may include endpoint credentials.
        return 'failed'

def dispatch(appointment, sender=send_push, now=None, repo=None):
    config = push_config()
    current_time = lambda: now or datetime.now(timezone.utc)
    repo = repo or ReminderRepository(clock=current_time)
    device, generation, due_at = appointment.device, appointment.generation, appointment.due_at
    if not repo.advance_appointment(device, generation, due_at):
        return {'outcome': 'superseded'}
    with connection() as db:
        row = db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE', (device,)).fetchone()
        if not row or not row['enabled'] or row['schedule_generation'] != generation:
            return {'outcome': 'superseded'}
        zone = ZoneInfo(row['timezone'])
        day = due_at.astimezone(zone).date()
        if day != current_time().astimezone(zone).date():
            return {'outcome': 'past-day-skipped'}
        # Keep the daily PK for old deployments, but replace its slot only for a
        # new explicit schedule generation. The subscription lock fences stale
        # callbacks. NULL identifies an old writer: only a later settings change
        # can reclaim it. Passive check-in sync never changes updated_at.
        claim = db.execute("""INSERT INTO reminder_deliveries
          (token_hash,local_date,schedule_generation) VALUES (%s,%s,%s)
          ON CONFLICT(token_hash,local_date) DO UPDATE SET
            schedule_generation=EXCLUDED.schedule_generation,
            claimed_at=now(),outcome='claimed'
          WHERE (reminder_deliveries.schedule_generation IS NOT NULL
                 AND reminder_deliveries.schedule_generation <> EXCLUDED.schedule_generation)
             OR (reminder_deliveries.schedule_generation IS NULL
                 AND reminder_deliveries.claimed_at < %s)
          RETURNING token_hash""", (device,day,generation,row['updated_at'])).fetchone()
        if not claim:
            return {'outcome': 'already-processed'}
    # Commit the unique claim first. The second lock orders a concurrent disable
    # or check-in against the bounded external send for this device only.
    with connection() as db:
        row = db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE', (device,)).fetchone()
        moment = current_time()
        if (not row or row['schedule_generation'] != generation or not eligible(row,moment)
                or moment.astimezone(ZoneInfo(row['timezone'])).date() != day):
            result = 'skipped'
        else:
            result = sender(row,config,day)
        # A settings change can win between transactions. Never replace the
        # outcome of the newer claim with this callback's skipped/failed result.
        db.execute("""UPDATE reminder_deliveries SET outcome=%s
          WHERE token_hash=%s AND local_date=%s AND schedule_generation=%s""",
          (result,device,day,generation))
        if result == 'expired':
            db.execute('UPDATE reminder_subscriptions SET enabled=false,queue_pending=false WHERE token_hash=%s', (device,))
    return {'outcome': result}
