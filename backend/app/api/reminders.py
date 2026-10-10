"""Preparation API: subscriptions can be stored, but delivery is not enabled yet."""
from datetime import date
import base64
import re
from typing import Annotated
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.services.reminder_repository import ReminderRepository, ReminderUnavailable

router = APIRouter(prefix='/api/reminders', tags=['reminders'])

class Subscription(BaseModel):
    model_config = ConfigDict(extra='forbid')
    endpoint: str = Field(max_length=2048)
    p256dh: str = Field(max_length=100)
    auth: str = Field(max_length=30)
    time: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    timezone: str = Field(max_length=100)

    @field_validator('endpoint')
    @classmethod
    def endpoint_safe(cls, value):
        url = urlsplit(value)
        host = url.hostname or ''
        known = host in {'fcm.googleapis.com', 'web.push.apple.com', 'updates.push.services.mozilla.com'} or host.endswith('.notify.windows.com')
        if url.scheme != 'https' or not known or url.username or url.password or url.port not in (None, 443) or url.fragment:
            raise ValueError('Unsupported push service endpoint')
        return value

    @field_validator('p256dh', 'auth')
    @classmethod
    def key_valid(cls, value, info):
        if not re.fullmatch(r'[A-Za-z0-9_-]+={0,2}', value):
            raise ValueError('Invalid push key')
        try:
            raw = base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))
        except ValueError:
            raise ValueError('Invalid push key') from None
        if len(raw) != (65 if info.field_name == 'p256dh' else 16):
            raise ValueError('Invalid push key length')
        if info.field_name == 'p256dh' and raw[0] != 4:
            raise ValueError('Invalid public key format')
        return value

    @field_validator('timezone')
    @classmethod
    def zone_valid(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError('Unknown timezone') from None
        return value

def owner(authorization: Annotated[str | None, Header()] = None):
    # Client must create 32 cryptographically random bytes and retain this secret.
    if not authorization or not re.fullmatch(r'Bearer [A-Za-z0-9_-]{43}', authorization):
        raise HTTPException(401, 'A valid reminder token is required.')
    return authorization[7:]

def repository():
    return ReminderRepository()

def call(action):
    try:
        return action()
    except ReminderUnavailable:
        raise HTTPException(503, 'Reminder storage is unavailable. No reminder was enabled.') from None

@router.get('/status')
def status(response: Response, token=Depends(owner), repo=Depends(repository)):
    response.headers['Cache-Control'] = 'no-store'
    return call(lambda: repo.status(token))

@router.post('/subscription')
def save(value: Subscription, response: Response, token=Depends(owner), repo=Depends(repository)):
    response.headers['Cache-Control'] = 'no-store'
    return call(lambda: repo.save(token, value))

class DisableUpdate(BaseModel):
    revision: int = Field(ge=1, le=9007199254740991, strict=True)

@router.post('/disable')
def disable(response: Response, value: 'DisableUpdate | None' = None, token=Depends(owner), repo=Depends(repository)):
    response.headers['Cache-Control'] = 'no-store'
    return call(lambda: repo.disable(token, value.revision if value else None))

class StateUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    date: date
    checked_in: bool = Field(strict=True)
    revision: int = Field(ge=1, le=9007199254740991, strict=True)

class EnabledSubscription(Subscription):
    date: date
    checked_in: bool = Field(strict=True)
    revision: int = Field(ge=1, le=9007199254740991, strict=True)

@router.get('/capabilities')
def capabilities(response: Response):
    from app.core.reminder_config import push_config
    response.headers['Cache-Control']='no-store'
    try:
        config=push_config()
        from app.services.reminder_repository import connection
        with connection() as db:
            db.execute('SELECT revision, synced_at FROM reminder_subscriptions LIMIT 0')
        return {'available':True,'publicKey':config['REMINDER_VAPID_PUBLIC_KEY']}
    except ReminderUnavailable:
        return {'available':False,'publicKey':None}

@router.post('/enable')
def enable(value: EnabledSubscription, token=Depends(owner), repo=Depends(repository)):
    from app.core.reminder_config import push_config
    call(push_config)
    from cryptography.hazmat.primitives.asymmetric import ec
    try:
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), base64.urlsafe_b64decode(value.p256dh + '=' * (-len(value.p256dh) % 4)))
    except ValueError:
        raise HTTPException(422, 'Invalid subscription public key.') from None
    return call(lambda:repo.enable(token,value))

@router.post('/sync')
def sync(value: StateUpdate, token=Depends(owner), repo=Depends(repository)):
    return call(lambda:repo.sync(token,value))

@router.post('/dispatch')
def dispatch(authorization: Annotated[str | None, Header()] = None):
    import hmac
    from app.core.reminder_config import setting
    from app.services.reminder_dispatch import dispatch as run
    secret=setting('REMINDER_CRON_SECRET')
    if len(secret)<32 or not hmac.compare_digest(authorization or '', 'Bearer '+secret):
        raise HTTPException(401,'Scheduler authentication required.')
    return call(run)
