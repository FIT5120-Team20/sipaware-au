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
            for name in ('001_reminders.sql','002_reminder_delivery.sql','003_reminder_appointments.sql','004_reminder_alarm_claims.sql'):
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


# Exercise the actual SQL claim/update ordering, not an in-memory simulation.
# Synthetic clock changes model deliberate same-day edits after a due callback.
def alarm(database, checked_in=False):
    published=[];clock=[NOW]
    def publish(row):
        published.append(row.copy())
        return 'message-'+str(len(published))
    repo=store.ReminderRepository(publisher=publish,canceller=lambda _:None,clock=lambda:clock[0])
    repo.enable(DEVICE_KEY,settings(1,checked_in=checked_in))
    def appointment():
        row=published[-1]
        return SimpleNamespace(device=row['token_hash'],generation=row['schedule_generation'],due_at=row['next_due_at'])
    return repo,clock,appointment


@pytest.mark.parametrize('first_outcome', ['accepted','failed','skipped'])
def test_explicit_new_time_can_notify_again_today(database,first_outcome):
    repo,clock,current=alarm(database,checked_in=first_outcome=='skipped')
    first=current();clock[0]=first.due_at;sent=[]
    def sender(*_):sent.append(1);return first_outcome
    assert delivery.dispatch(first,sender=sender,now=clock[0],repo=repo)['outcome']==first_outcome
    assert delivery.dispatch(first,sender=sender,now=clock[0],repo=repo)['outcome']=='already-processed'
    # Deletion synchronization alone is not an instruction to ring immediately.
    repo.sync(DEVICE_KEY,settings(2,checked_in=False))
    assert delivery.dispatch(first,sender=sender,now=clock[0],repo=repo)['outcome']=='already-processed'
    repo.enable(DEVICE_KEY,settings(3,time='20:01'))
    second=current()
    assert second.generation!=first.generation and second.due_at==first.due_at+timedelta(minutes=1)
    clock[0]=second.due_at
    assert delivery.dispatch(first,sender=sender,now=clock[0],repo=repo)['outcome']=='superseded'
    def accepted(*_):sent.append(1);return 'accepted'
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(lambda _:delivery.dispatch(second,sender=accepted,now=clock[0],repo=repo)['outcome'],range(2)))
    assert set(outcomes)=={'accepted','already-processed'}
    assert len(sent)==(1 if first_outcome=='skipped' else 2)


def test_unchanged_enable_and_passive_status_do_not_rearm(database):
    repo,clock,current=alarm(database);first=current();clock[0]=first.due_at
    assert delivery.dispatch(first,sender=lambda *_:'accepted',now=clock[0],repo=repo)['outcome']=='accepted'
    before=repo.status(DEVICE_KEY)
    assert repo.enable(DEVICE_KEY,settings(2))==before
    assert current().generation==first.generation
    assert repo.status(DEVICE_KEY)==before
    assert delivery.dispatch(first,sender=lambda *_:pytest.fail('Duplicate push'),now=clock[0],repo=repo)['outcome']=='already-processed'
    # Selecting a time already passed schedules tomorrow, not an immediate send.
    changed=repo.enable(DEVICE_KEY,settings(3,time='19:59'))
    assert datetime.fromisoformat(changed['next_due_at'])==first.due_at+timedelta(days=1,minutes=-1)


def test_still_checked_in_skips_even_after_explicit_time_change(database):
    repo,clock,current=alarm(database,checked_in=True);first=current();clock[0]=first.due_at
    assert delivery.dispatch(first,sender=lambda *_:pytest.fail('Checked-in push'),now=clock[0],repo=repo)['outcome']=='skipped'
    repo.enable(DEVICE_KEY,settings(2,time='20:01',checked_in=True));second=current();clock[0]=second.due_at
    assert delivery.dispatch(second,sender=lambda *_:pytest.fail('Checked-in push'),now=clock[0],repo=repo)['outcome']=='skipped'


def test_legacy_daily_claim_requires_a_later_explicit_settings_change(database):
    repo,clock,current=alarm(database);first=current();clock[0]=first.due_at
    with database() as db:
        db.execute('UPDATE reminder_subscriptions SET updated_at=%s WHERE token_hash=%s',(NOW,first.device))
        db.execute("INSERT INTO reminder_deliveries(token_hash,local_date,claimed_at,outcome) VALUES (%s,%s,%s,'accepted')",(first.device,first.due_at.date(),NOW+timedelta(minutes=1)))
    assert delivery.dispatch(first,sender=lambda *_:pytest.fail('Legacy duplicate'),now=clock[0],repo=repo)['outcome']=='already-processed'
    repo.enable(DEVICE_KEY,settings(2))
    assert delivery.dispatch(first,sender=lambda *_:pytest.fail('Unchanged legacy duplicate'),now=clock[0],repo=repo)['outcome']=='already-processed'
    repo.enable(DEVICE_KEY,settings(3,time='20:01'));second=current();clock[0]=second.due_at
    assert delivery.dispatch(second,sender=lambda *_:'accepted',now=clock[0],repo=repo)['outcome']=='accepted'


def test_late_old_outcome_cannot_overwrite_new_generation(database,monkeypatch):
    repo,clock,current=alarm(database);first=current();clock[0]=first.due_at;calls=[0];second=[None]
    @contextmanager
    def interleaved():
        calls[0]+=1
        if calls[0]==2:
            # Deliberately run a newer appointment between the old callback's
            # committed claim and its state recheck, then let the old one finish.
            repo.enable(DEVICE_KEY,settings(2,time='20:01'))
            second[0]=current();clock[0]=second[0].due_at
            assert delivery.dispatch(second[0],sender=lambda *_:'accepted',now=clock[0],repo=repo)['outcome']=='accepted'
        with database() as db:yield db
    monkeypatch.setattr(delivery,'connection',interleaved)
    assert delivery.dispatch(first,sender=lambda *_:pytest.fail('Superseded push'),now=first.due_at,repo=repo)['outcome']=='skipped'
    with database() as db:
        row=db.execute('SELECT outcome,schedule_generation FROM reminder_deliveries WHERE token_hash=%s',(first.device,)).fetchone()
    assert row==dict(outcome='accepted',schedule_generation=second[0].generation)


def test_additive_migration_preserves_existing_claims_and_old_writer(database):
    repo,_,current=alarm(database);first=current()
    with database() as db:
        db.execute('ALTER TABLE reminder_deliveries DROP COLUMN schedule_generation')
        db.execute("INSERT INTO reminder_deliveries(token_hash,local_date,outcome) VALUES (%s,%s,'failed')",(first.device,first.due_at.date()))
        before=db.execute('SELECT * FROM reminder_deliveries').fetchone()
        migration=(Path(__file__).resolve().parents[3]/'backend/migrations/004_reminder_alarm_claims.sql').read_text()
        db.execute(migration);db.execute(migration)
        after=db.execute('SELECT * FROM reminder_deliveries').fetchone()
        assert after.pop('schedule_generation') is None and after==before
        assert db.execute('INSERT INTO reminder_deliveries(token_hash,local_date) VALUES (%s,%s) ON CONFLICT DO NOTHING RETURNING token_hash',(first.device,first.due_at.date())).fetchone() is None
