import { getCurrentLocalCalendarDateKey } from '../utils/localCalendarDate'

export interface CheckInCreationMetadata {
  createdLocalDate: string
  createdTimezoneOffsetMinutes: number
}

/** One clock snapshot for the timestamp, calendar date and creation offset. */
export function captureCheckInCreation(now = new Date()): CheckInCreationMetadata & { createdAt: string } {
  return {
    createdAt: now.toISOString(),
    createdLocalDate: getCurrentLocalCalendarDateKey(now),
    createdTimezoneOffsetMinutes: now.getTimezoneOffset(),
  }
}

/** Time-limited awards require verifiable creation data; never infer an offset. */
export function hasValidCheckInCreation(
  value: { createdLocalDate?: unknown; createdTimezoneOffsetMinutes?: unknown },
  timestamp: string,
): value is CheckInCreationMetadata {
  const instant = new Date(timestamp)
  const offset = value.createdTimezoneOffsetMinutes
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== timestamp
    || typeof offset !== 'number' || !Number.isInteger(offset) || Math.abs(offset) > 24 * 60
    || typeof value.createdLocalDate !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value.createdLocalDate)) return false
  const wallClock = new Date(instant.getTime() - offset * 60_000)
  return Number.isFinite(wallClock.getTime()) && wallClock.toISOString().slice(0, 10) === value.createdLocalDate
}
