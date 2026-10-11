"""Optional REAL PostgreSQL regression tests in an isolated disposable schema.

Set SIPAWARE_TEST_POSTGRES_URL to a localhost test database. Cloud/production URLs
are rejected. Missing local infrastructure is reported as SKIP, never PASS.
"""
import os
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlsplit
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import psycopg
from psycopg import sql
from psycopg.rows import dict_row
import pytest
from app.services import reminder_repository as store, reminder_dispatch as delivery

NOW=datetime(2026,10,11,8,tzinfo=timezone.utc)
DEVICE_KEY='a'*43


def test_pooler_compatible_connection_limits(monkeypatch):
    """Exercise the real repository connection without cloud or startup options."""
    url=os.getenv('SIPAWARE_TEST_POSTGRES_URL','')
    if not url: pytest.skip('Local PostgreSQL integration URL not configured')
    assert urlsplit(url).hostname in ('127.0.0.1','localhost','::1')
    connect=psycopg.connect
    def pooled_connection(*args,**kwargs):
        assert 'options' not in kwargs, 'Neon pooler rejects startup options'
        return connect(*args,**kwargs)
    monkeypatch.setattr(store,'reminder_database_url',lambda:url)
    monkeypatch.setattr(store.psycopg,'connect',pooled_connection)
    with store.connection() as db:
        assert db.execute('SHOW statement_timeout').fetchone()['statement_timeout']=='5s'
        assert db.execute('SHOW lock_timeout').fetchone()['lock_timeout']=='2s'


@pytest.fixture
def database(monkeypatch):
    url=os.getenv('SIPAWARE_TEST_POSTGRES_URL','')
    if not url: pytest.skip('Local PostgreSQL integration URL not configured')
    assert urlsplit(url).hostname in ('127.0.0.1','localhost','::1'), 'Refuse shared/cloud database'
    schema='reminder_test_'+uuid4().hex
    with psycopg.connect(url,autocommit=True) as db:
        db.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(schema)))
    @contextmanager
    def connect():
        with psycopg.connect(url,row_factory=dict_row,options=f'-c search_path={schema} -c statement_timeout=5000 -c lock_timeout=2000') as db:
            yield db
    try:
        with connect() as db:
            for name in ('001_reminders.sql','002_reminder_delivery.sql','003_reminder_appointments.sql'):
                db.execute((Path(__file__).resolve().parents[3]/'backend/migrations'/name).read_text(encoding='utf-8'))
        monkeypatch.setattr(store,'connection',connect)
        monkeypatch.setattr(delivery,'connection',connect)
        monkeypatch.setattr(delivery,'push_config',lambda:{})
        yield connect
    finally:
        with psycopg.connect(url,autocommit=True) as db:
            db.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema)))


def settings(revision=1,**changes):
    return SimpleNamespace(**dict(dict(endpoint='https://fcm.googleapis.com/synthetic',p256dh='test',auth='test',time='20:00',timezone='Australia/Sydney',date=NOW.date(),checked_in=False,revision=revision),**changes))


def test_revision_order_and_replayed_callback(database):
    published=[]
    def publish(row): published.append(row.copy());return 'message-'+str(len(published))
    clock=[NOW]
    repo=store.ReminderRepository(publisher=publish,canceller=lambda _:None,clock=lambda:clock[0])
    assert repo.enable(DEVICE_KEY,settings(10))['enabled']
    old=published[-1]
    assert repo.enable(DEVICE_KEY,settings(12,time='21:00'))['time']=='21:00'
    assert repo.disable(DEVICE_KEY,11)['enabled']
    assert not repo.advance_appointment(old['token_hash'],old['schedule_generation'],old['next_due_at'])
    current=published[-1]
    clock[0]=current['next_due_at']
    appointment=SimpleNamespace(device=current['token_hash'],generation=current['schedule_generation'],due_at=current['next_due_at'])
    sent=[]
    def sender(*_):sent.append(1);return 'accepted'
    assert delivery.dispatch(appointment,sender=sender,now=clock[0],repo=repo)['outcome']=='accepted'
    assert delivery.dispatch(appointment,sender=sender,now=clock[0],repo=repo)['outcome']=='already-processed'
    assert len(sent)==1 and len(published)==3
    assert repo.disable(DEVICE_KEY,13)['enabled'] is False
    assert delivery.dispatch(appointment,sender=sender,now=clock[0],repo=repo)['outcome']=='superseded'


def test_pending_publication_is_repaired_without_daily_duplicate(database):
    calls=[]
    def publish(row):
        calls.append(row.copy())
        if len(calls)==1:raise store.ReminderUnavailable('synthetic outage')
        return 'message-1'
    repo=store.ReminderRepository(publisher=publish,canceller=lambda _:None,clock=lambda:NOW)
    with pytest.raises(store.ReminderUnavailable):repo.enable(DEVICE_KEY,settings())
    assert repo.status(DEVICE_KEY)['needs_attention']
    repo.sync(DEVICE_KEY,settings(2))
    assert repo.status(DEVICE_KEY)['enabled'] and len(calls)==2


def test_concurrent_callbacks_send_once_and_confirmed_day_is_suppressed(database):
    published=[]
    def publish(row):published.append(row.copy());return 'message-'+str(row['next_due_at'])
    repo=store.ReminderRepository(publisher=publish,canceller=lambda _:None,clock=lambda:NOW)
    repo.enable(DEVICE_KEY,settings())
    row=published[0]
    due=row['next_due_at']
    repo.clock=lambda:due
    sent=[]
    appointment=SimpleNamespace(device=row['token_hash'],generation=row['schedule_generation'],due_at=due)
    def sender(*_):sent.append(1);return 'accepted'
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:delivery.dispatch(appointment,sender=sender,now=due,repo=repo),range(2)))
    assert len(sent)==1 and {r['outcome'] for r in results}=={'accepted','already-processed'}
    next_day=due+timedelta(days=1)
    repo.clock=lambda:next_day
    repo.sync(DEVICE_KEY,settings(2,date=next_day.date(),checked_in=True))
    appointment.due_at=next_day
    assert delivery.dispatch(appointment,sender=sender,now=next_day,repo=repo)['outcome']=='skipped'
    assert len(sent)==1


def test_disable_before_delayed_first_enable_leaves_ordering_tombstone(database):
    sent=[]
    repo=store.ReminderRepository(publisher=lambda row:sent.append(row) or 'message',canceller=lambda _:None,clock=lambda:NOW)
    assert repo.disable(DEVICE_KEY,20)['enabled'] is False
    assert repo.enable(DEVICE_KEY,settings(19))['enabled'] is False
    assert not sent
    assert repo.enable(DEVICE_KEY,settings(21))['enabled'] is True
    assert len(sent)==1
