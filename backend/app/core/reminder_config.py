"""Deployment readiness; all secrets stay on the server."""
import os
from pathlib import Path
from dotenv import dotenv_values
from app.services.reminder_repository import ReminderUnavailable

def setting(name):
    return os.environ.get(name) or dotenv_values(Path(__file__).resolve().parents[2] / '.env').get(name) or ''

def push_config():
    required = ['REMINDER_DATABASE_URL', 'REMINDER_VAPID_PRIVATE_KEY', 'REMINDER_VAPID_PUBLIC_KEY', 'REMINDER_VAPID_SUBJECT', 'REMINDER_CRON_SECRET']
    if setting('REMINDER_DELIVERY_READY') != '1' or any(not setting(key) for key in required):
        raise ReminderUnavailable('Background delivery is not configured.')
    if len(setting('REMINDER_CRON_SECRET')) < 32:
        raise ReminderUnavailable('Scheduler key is not configured.')
    try:
        import pywebpush  # noqa: F401
    except ImportError:
        raise ReminderUnavailable('Push dependency is unavailable.') from None
    from app.services.reminder_queue import queue_config
    queue_config()
    return {key: setting(key) for key in required}
