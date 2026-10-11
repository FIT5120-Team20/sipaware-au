"""HTTP contract checks with an injected repository; no live storage or push.
The retired unversioned preparation route must not overwrite active settings.
"""
import asyncio
import base64
import httpx
import pytest
from app.main import app
from app.api.reminders import repository
from app.services.reminder_repository import ReminderUnavailable

def request(method, path, **kwargs):
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as client:
            return await client.request(method,path,**kwargs)
    return asyncio.run(run())

headers=dict([('Authorization','Bearer '+'a'*43)])
def payload():
    encode=lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
    return {'endpoint':'https://fcm.googleapis.com/fcm/send/test','p256dh':encode(b'\x04'+b'a'*64),'auth':encode(b'b'*16),'time':'20:00','timezone':'UTC'}

class Fake:
    def save(self, token, value):
        return {'saved':False,'enabled':False}
    def status(self, token):
        return {'saved':False,'enabled':False,'time':None,'timezone':None}
    def disable(self, token, revision=None):
        return {'enabled':False}

@pytest.fixture(autouse=True)
def fake():
    app.dependency_overrides[repository]=Fake
    yield
    app.dependency_overrides.pop(repository,None)

@pytest.mark.parametrize('prefix',['','/iteration3'])
def test_legacy_preparation_without_claiming_delivery(prefix):
    response=request('POST',prefix+'/api/reminders/subscription',headers=headers,json=payload())
    assert response.status_code==200
    assert response.json()=={'saved':False,'enabled':False}
    assert response.headers['cache-control']=='no-store'

def test_requires_owner_token():
    assert request('GET','/api/reminders/status').status_code==401

@pytest.mark.parametrize('field,value',[('endpoint','https://127.0.0.1/private'),('endpoint','https://fcm.googleapis.com.evil.test/push'),('time','25:00'),('timezone','not/a-zone'),('auth','bad'),('p256dh','bad')])
def test_rejects_invalid_subscription(field,value):
    body=payload();body[field]=value
    assert request('POST','/api/reminders/subscription',headers=headers,json=body).status_code==422

def test_storage_failure_is_sanitized():
    class Broken(Fake):
        def save(self,*args): raise ReminderUnavailable('secret-connection-string')
    app.dependency_overrides[repository]=Broken
    response=request('POST','/api/reminders/subscription',headers=headers,json=payload())
    assert response.status_code==503
    assert 'secret' not in response.text

def test_disable_and_status():
    assert request('POST','/api/reminders/disable',headers=headers,json={'revision':1}).json()=={'enabled':False}
    assert request('GET','/api/reminders/status',headers=headers).json()['enabled'] is False


def test_disable_requires_ordering_and_rejects_extra_history():
    assert request('POST','/api/reminders/disable',headers=headers).status_code == 422
    assert request('POST','/api/reminders/disable',headers=headers,json={'revision':1,'records':[]}).status_code == 422


def test_legacy_preparation_cannot_overwrite_active_settings():
    from app.services.reminder_repository import ReminderRepository
    assert ReminderRepository().save('a'*43, payload()) == {'saved':False,'enabled':False}
