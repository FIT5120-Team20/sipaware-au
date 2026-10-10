"""Bounded scheduler; an atomic claim is committed BEFORE the external request.
A failed or uncertain send is not retried that day: duplicates are worse than misses.
"""
import json
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from app.services.reminder_repository import connection
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

def dispatch(sender=send_push, now=None):
    config = push_config()
    fixed_now = now
    now = now or datetime.now(timezone.utc)
    counts={'claimed':0,'accepted':0,'failed':0,'expired':0}
    # Subscription persists across days. Only a confirmed check-in for the
    # device's current local date suppresses delivery; stale state does not.
    with connection() as db:
        rows=db.execute('''SELECT * FROM reminder_subscriptions s
          WHERE enabled
          AND NOT (checked_in IS TRUE AND checkin_date IS NOT DISTINCT FROM
                   (%s AT TIME ZONE timezone)::date)
          AND reminder_time <= to_char(%s AT TIME ZONE timezone, 'HH24:MI')
          AND NOT EXISTS (SELECT 1 FROM reminder_deliveries d WHERE d.token_hash=s.token_hash
                          AND d.local_date=(%s AT TIME ZONE s.timezone)::date)
          ORDER BY synced_at ASC NULLS FIRST LIMIT 10''',(now,now,now)).fetchall()
    for candidate in rows:
        with connection() as db:
            row=db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE', (candidate['token_hash'],)).fetchone()
            if not row or not eligible(row,now): continue
            day=now.astimezone(ZoneInfo(row['timezone'])).date()
            claim=db.execute('INSERT INTO reminder_deliveries(token_hash,local_date) VALUES (%s,%s) ON CONFLICT DO NOTHING RETURNING token_hash',(row['token_hash'],day)).fetchone()
            if not claim: continue
        counts['claimed']+=1
        # Recheck under the same lock used by disable and state synchronization.
        with connection() as db:
            current=db.execute('SELECT * FROM reminder_subscriptions WHERE token_hash=%s FOR UPDATE',(row['token_hash'],)).fetchone()
            send_now = fixed_now or datetime.now(timezone.utc)
            if (not current or not eligible(current, send_now)
                    or send_now.astimezone(ZoneInfo(current['timezone'])).date() != day):
                result='failed'
            else:
                result=sender(current,config,day)
            counts[result]+=1
            db.execute('UPDATE reminder_deliveries SET outcome=%s WHERE token_hash=%s AND local_date=%s',(result,row['token_hash'],day))
            if result=='expired': db.execute('UPDATE reminder_subscriptions SET enabled=false WHERE token_hash=%s',(row['token_hash'],))
    return counts
