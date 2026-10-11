"""Calendar scheduling for reminders; no I/O or access to drinking history.

Appointments follow the device's saved IANA timezone, rather than adding 24 UTC
hours. A skipped DST time moves to the first real minute after the gap; a repeated
time uses its first occurrence. There is one appointment per local calendar day.
"""
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def due_on(day: date, clock: str, zone_name: str) -> datetime:
    zone = ZoneInfo(zone_name)
    naive = datetime.combine(day, time.fromisoformat(clock))
    # Round-trip through UTC rejects imaginary local times during a DST gap.
    # A full skipped calendar day (for example historic Pacific/Apia) is bounded.
    for offset in range(24 * 60 + 1):
        candidate = naive + timedelta(minutes=offset)
        aware = candidate.replace(tzinfo=zone, fold=0)
        utc = aware.astimezone(timezone.utc)
        if utc.astimezone(zone).replace(tzinfo=None) == candidate:
            return utc
    raise ValueError('No valid local reminder time found.')


def next_due(now: datetime, clock: str, zone_name: str) -> datetime:
    """Return the next future wall-clock appointment, never a catch-up batch."""
    local_day = now.astimezone(ZoneInfo(zone_name)).date()
    for offset in range(3):
        candidate = due_on(local_day + timedelta(days=offset), clock, zone_name)
        if candidate > now:
            return candidate
    raise ValueError('No future reminder time found.')
