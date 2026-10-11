"""QStash adapter: one delayed callback per device, never a recurring DB poll.

Only opaque device/generation/due identifiers leave the backend. Push endpoints,
keys and completed-check-in state stay in the dedicated reminder database. Fixed
destination/provider validation prevents a configuration or request becoming an
arbitrary credential-forwarding proxy. No provider response bodies are logged.
"""
import hashlib
import json
from datetime import timezone
from urllib.parse import quote, urlsplit

import httpx

from app.core.reminder_config import setting
from app.services.reminder_repository import ReminderUnavailable


def queue_config():
    base = setting('REMINDER_QSTASH_URL').rstrip('/')
    target = setting('REMINDER_CALLBACK_URL')
    provider_key = setting('REMINDER_QSTASH_TOKEN')
    callback_key = setting('REMINDER_CRON_SECRET')
    allowed = {'qstash.upstash.io', 'qstash-us-east-1.upstash.io',
               'qstash-eu-central-1.upstash.io'}
    try:
        provider = urlsplit(base)
        destination = urlsplit(target)
        provider_port, destination_port = provider.port, destination.port
    except ValueError:
        raise ReminderUnavailable('Reminder queue is not configured.') from None
    if (provider.scheme != 'https' or provider.hostname not in allowed
            or provider.path or provider.query or provider.fragment or provider.username
            or provider.password or provider_port not in (None, 443)
            or destination.scheme != 'https' or destination.hostname != 'sipaware.app'
            or destination.path != '/iteration3/api/reminders/dispatch'
            or destination.query or destination.fragment or destination.username
            or destination.password or destination_port not in (None, 443)
            or not provider_key or len(callback_key) < 32):
        raise ReminderUnavailable('Reminder queue is not configured.')
    return {'base': base, 'target': target, 'provider_key': provider_key, 'callback_key': callback_key}


def callback_body(row):
    return {'device': row['token_hash'], 'generation': str(row['schedule_generation']),
            'due_at': row['next_due_at'].astimezone(timezone.utc).isoformat()}


def publish(row, transport=None):
    """Publish durably before reporting active; uncertain responses are retryable.

Provider deduplication is only a short-window optimisation. PostgreSQL generations
and unique daily delivery claims are the durable replay/duplicate protection.
"""
    config = queue_config()
    body = json.dumps(callback_body(row), separators=(',', ':'), sort_keys=True)
    auth_header = 'Authorization'
    forwarded_auth_header = 'Upstash-Forward-Authorization'
    headers = {
        auth_header: 'Bearer ' + config['provider_key'], 'Content-Type': 'application/json',
        forwarded_auth_header: 'Bearer ' + config['callback_key'],
        'Upstash-Not-Before': str(int(row['next_due_at'].timestamp())),
        'Upstash-Retries': '3', 'Upstash-Retry-Delay': '60000 * pow(2, retried)',
        'Upstash-Timeout': '25s',
        'Upstash-Deduplication-Id': hashlib.sha256(body.encode()).hexdigest(),
    }
    try:
        with httpx.Client(timeout=httpx.Timeout(8, connect=5), follow_redirects=False,
                          transport=transport) as client:
            response = client.post(config['base'] + '/v2/publish/' + quote(config['target'], safe=''),
                                   headers=headers, content=body)
            response.raise_for_status()
            receipt = response.json()
            message_id = receipt.get('messageId') if isinstance(receipt, dict) else None
            if not isinstance(message_id, str) or not 1 <= len(message_id) <= 200:
                raise ValueError('Invalid queue receipt')
            return message_id
    except (httpx.HTTPError, ValueError, TypeError):
        raise ReminderUnavailable('The next reminder could not be scheduled.') from None


def cancel(message_id, transport=None):
    """Best-effort resource cleanup; DB generation/disabled state remains authority."""
    if not message_id:
        return
    try:
        config = queue_config()
        with httpx.Client(timeout=5, follow_redirects=False, transport=transport) as client:
            client.delete(config['base'] + '/v2/messages/' + quote(message_id, safe=''),
                          headers=dict([('Authorization', 'Bearer ' + config['provider_key'])]))
    except (httpx.HTTPError, ReminderUnavailable):
        # An already queued callback is harmless after its generation is invalidated.
        pass
