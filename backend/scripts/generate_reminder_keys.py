"""Run locally after installing requirements; writes secrets only to a gitignored file."""
import base64
import secrets
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

path=Path(__file__).resolve().parents[1]/'.env.reminder.generated'
private=ec.generate_private_key(ec.SECP256R1())
public=private.public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)
private_der=private.private_bytes(serialization.Encoding.DER,serialization.PrivateFormat.PKCS8,serialization.NoEncryption())
encode=lambda value:base64.urlsafe_b64encode(value).decode().rstrip('=')
# Exclusive creation prevents accidental key rotation that would break subscriptions.
with path.open('x',encoding='utf-8') as file:
    file.write('REMINDER_VAPID_PUBLIC_KEY='+encode(public)+'\n')
    file.write('REMINDER_VAPID_PRIVATE_KEY='+encode(private_der)+'\n')
    file.write('='.join(('REMINDER_CRON_SECRET',secrets.token_urlsafe(32)))+'\n')
print('Keys saved to backend/.env.reminder.generated. Do not share or commit this file.')
