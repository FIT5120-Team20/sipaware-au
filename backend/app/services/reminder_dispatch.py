"""One callback addresses one device. Daily claims prevent duplicate delivery.
The next appointment is queued BEFORE a push attempt; uncertain push outcomes are
not retried that day. Provider acceptance does not prove device display.
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
        claim = db.execute("""INSERT INTO reminder_deliveries(token_hash,local_date)
          VALUES (%s,%s) ON CONFLICT DO NOTHING RETURNING token_hash""", (device,day)).fetchone()
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
        db.execute('UPDATE reminder_deliveries SET outcome=%s WHERE token_hash=%s AND local_date=%s', (result,device,day))
        if result == 'expired':
            db.execute('UPDATE reminder_subscriptions SET enabled=false,queue_pending=false WHERE token_hash=%s', (device,))
    return {'outcome': result}
