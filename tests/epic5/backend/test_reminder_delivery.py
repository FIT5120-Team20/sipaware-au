import asyncio
from datetime import datetime, timezone, timedelta
from app.services.reminder_dispatch import eligible
from app.core import reminder_config
from app.main import app
import httpx

NOW=datetime(2026,10,11,9,0,tzinfo=timezone.utc)
def row(**changes):
    return dict({'enabled':True,'timezone':'Australia/Sydney','reminder_time':'20:00','checkin_date':NOW.astimezone(__import__('zoneinfo').ZoneInfo('Australia/Sydney')).date(),'checked_in':False,'synced_at':NOW},**changes)

def test_due_in_device_timezone(): assert eligible(row(),NOW)
def test_before_time(): assert not eligible(row(reminder_time='20:01'),NOW)
def test_completed(): assert not eligible(row(checked_in=True),NOW)
def test_disabled(): assert not eligible(row(enabled=False),NOW)
def test_unknown(): assert eligible(row(checked_in=None),NOW)
def test_stale(): assert eligible(row(synced_at=NOW-timedelta(days=2)),NOW)
def test_previous_day(): assert eligible(row(checkin_date=(NOW-timedelta(days=1)).date(), checked_in=True),NOW)
def test_future_sync(): assert eligible(row(synced_at=NOW+timedelta(seconds=1)),NOW)

def test_scheduler_requires_separate_secret(monkeypatch):
    monkeypatch.setattr(reminder_config,'setting',lambda name:'s'*32 if name=='REMINDER_CRON_SECRET' else '')
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as c:
            for headers in ({},{'Authorization':'Bearer '+'a'*43}):
                assert (await c.post('/api/reminders/dispatch',headers=headers)).status_code==401
    asyncio.run(run())

def test_missing_configuration_never_advertises_ready(monkeypatch):
    monkeypatch.setattr(reminder_config,'setting',lambda name:'')
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as c:
            r=await c.get('/iteration3/api/reminders/capabilities')
            assert r.json()=={'available':False,'publicKey':None}
    asyncio.run(run())


def test_no_state_still_reminds():
    assert eligible(row(checkin_date=None, checked_in=None, synced_at=None), NOW)

def test_old_sync_of_today_completed_still_suppresses():
    assert not eligible(row(checked_in=True, synced_at=NOW-timedelta(hours=12)), NOW)

def test_new_local_day_resets_completed_status():
    assert eligible(row(checked_in=True), NOW+timedelta(days=1))


def test_dispatch_claims_once_per_local_day_and_rechecks_state(monkeypatch):
    from contextlib import contextmanager
    from app.services import reminder_dispatch as service
    state = row(token_hash='device', checked_in=True,
                checkin_date=(NOW-timedelta(days=2)).date())
    claims = set()
    sends = []
    class Result:
        def __init__(self, value): self.value = value
        def fetchall(self): return self.value
        def fetchone(self): return self.value
    class Database:
        def execute(self, sql, args):
            if sql.startswith('SELECT * FROM reminder_subscriptions s'):
                return Result([state.copy()])
            if sql.startswith('SELECT * FROM reminder_subscriptions WHERE'):
                return Result(state.copy())
            if sql.startswith('INSERT INTO reminder_deliveries'):
                if args in claims: return Result(None)
                claims.add(args)
                return Result({'token_hash': args[0]})
            if sql.startswith('UPDATE reminder_deliveries'): return Result(None)
            raise AssertionError(sql)
    @contextmanager
    def connect(): yield Database()
    monkeypatch.setattr(service, 'connection', connect)
    monkeypatch.setattr(service, 'push_config', lambda: {})
    def sender(current, config, day):
        sends.append(day)
        return 'accepted'
    assert service.dispatch(sender, NOW)['accepted'] == 1
    assert service.dispatch(sender, NOW)['claimed'] == 0
    assert service.dispatch(sender, NOW+timedelta(days=1))['accepted'] == 1
    state['checkin_date'] = (NOW+timedelta(days=2)).date()
    assert service.dispatch(sender, NOW+timedelta(days=2))['claimed'] == 0
    state['enabled'] = False
    assert service.dispatch(sender, NOW+timedelta(days=3))['claimed'] == 0
    assert len(sends) == 2
