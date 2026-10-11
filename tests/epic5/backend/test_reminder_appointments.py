"""Scheduling contract tests use synthetic keys and transport, never live accounts."""
from datetime import datetime, date, timezone, timedelta
from uuid import UUID
import json
import httpx
import pytest
from app.services.reminder_time import due_on, next_due
from app.services import reminder_queue as queue
from app.services.reminder_repository import ReminderUnavailable

UTC = timezone.utc
NOW = datetime(2026,10,11,9,tzinfo=UTC)


def test_spring_gap_uses_first_real_minute():
    assert due_on(date(2026,10,4),'02:30','Australia/Sydney') == datetime(2026,10,3,16,tzinfo=UTC)


def test_fall_repeated_time_chooses_first_occurrence():
    assert due_on(date(2027,4,4),'02:30','Australia/Sydney') == datetime(2027,4,3,15,30,tzinfo=UTC)


@pytest.mark.parametrize('start,hours',[(datetime(2026,10,3,10,tzinfo=UTC),23),(datetime(2027,4,3,9,tzinfo=UTC),25)])
def test_next_day_follows_local_clock_not_24_hours(start,hours):
    assert (next_due(start,'20:00','Australia/Sydney')-start).total_seconds() == hours*3600


def test_next_due_is_strictly_future():
    assert next_due(NOW,'20:00','Australia/Sydney') == NOW+timedelta(days=1)


@pytest.fixture
def configuration(monkeypatch):
    values=dict([('REMINDER_QSTASH_URL','https://qstash.upstash.io'),
            ('REMINDER_CALLBACK_URL','https://sipaware.app/iteration3/api/reminders/dispatch'),
            ('REMINDER_QSTASH_TOKEN','synthetic-provider-token'),('REMINDER_CRON_SECRET','s'*32)])
    monkeypatch.setattr(queue,'setting',lambda key:values.get(key,''))
    return values


def row():
    return {'token_hash':'a'*64,'schedule_generation':UUID(int=1),'next_due_at':NOW}


def test_publish_contains_only_opaque_metadata_and_bounded_delivery(configuration):
    requests=[]
    def handler(request):
        requests.append(request)
        return httpx.Response(200,json={'messageId':'synthetic-message'})
    transport=httpx.MockTransport(handler)
    assert queue.publish(row(),transport)=='synthetic-message'
    queue.publish(row(),transport)
    first=requests[0]
    assert set(json.loads(first.content)) == {'device','generation','due_at'}
    assert first.headers['Upstash-Not-Before'] == str(int(NOW.timestamp()))
    assert first.headers['Upstash-Retries']=='3'
    assert first.headers['Upstash-Forward-Authorization']=='Bearer '+'s'*32
    assert first.headers['Upstash-Deduplication-Id']==requests[1].headers['Upstash-Deduplication-Id']
    assert 'schedules' not in first.url.path


@pytest.mark.parametrize('name,value',[
    ('REMINDER_CALLBACK_URL','https://evil.test/iteration3/api/reminders/dispatch'),
    ('REMINDER_CALLBACK_URL','https://sipaware.app/api/reminders/dispatch'),
    ('REMINDER_CALLBACK_URL','https://sipaware.app/iteration3/api/reminders/dispatch?unexpected=1'),
    ('REMINDER_QSTASH_URL','https://qstash.upstash.io.evil.test'),
    ('REMINDER_CRON_SECRET','short'),
    ('REMINDER_QSTASH_URL','https://qstash.upstash.io:invalid'),
])
def test_configuration_cannot_redirect_credentials(configuration,name,value):
    configuration[name]=value
    with pytest.raises(ReminderUnavailable): queue.queue_config()


def test_queue_error_hides_provider_body(configuration):
    with pytest.raises(ReminderUnavailable) as exc:
        queue.publish(row(),httpx.MockTransport(lambda _:httpx.Response(429,text='private-endpoint')))
    assert 'private-endpoint' not in str(exc.value)


def test_failed_cancellation_does_not_undo_committed_disable(configuration):
    def offline(_): raise httpx.ConnectError('offline')
    queue.cancel('synthetic-message',httpx.MockTransport(offline))


def test_malformed_queue_receipt_is_retryable(configuration):
    with pytest.raises(ReminderUnavailable):
        queue.publish(row(),httpx.MockTransport(lambda _:httpx.Response(200,json=[])))
