/**
 * Local-calendar helpers for recorded consumption and rolling-day grouping.
 *
 * A record's ISO instant is paired with its offset at consumption so its
 * originally entered wall-clock date remains stable after timezone changes.
 */
import type { DrinkingRecord } from '../types/drinkingRecord'

const MILLISECONDS_PER_MINUTE = 60_000
const MILLISECONDS_PER_CALENDAR_DAY = 86_400_000
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export type LocalCalendarDateKey = `${number}-${string}-${string}`

type RecordedDateTime = Pick<
  DrinkingRecord,
  'consumedAt' | 'consumedTimezoneOffsetMinutes'
>

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

function createDateKey(year: number, month: number, day: number) {
  return `${year}-${padDatePart(month)}-${padDatePart(
    day,
  )}` as LocalCalendarDateKey
}

/**
 * Represent the recorded wall clock as UTC fields on a Date.
 * Consumers must use UTC getters because the shift has already restored the
 * entered local components.
 */
export function getRecordedLocalWallClockDate(record: RecordedDateTime): Date {
  return new Date(
    new Date(record.consumedAt).getTime() -
      record.consumedTimezoneOffsetMinutes * MILLISECONDS_PER_MINUTE,
  )
}

/** Return the local calendar date intended when the record was entered. */
export function getRecordLocalCalendarDateKey(
  record: RecordedDateTime,
): LocalCalendarDateKey {
  const wallClockDate = getRecordedLocalWallClockDate(record)
  return createDateKey(
    wallClockDate.getUTCFullYear(),
    wallClockDate.getUTCMonth() + 1,
    wallClockDate.getUTCDate(),
  )
}

/** Return today's calendar key in the viewer's current device timezone. */
export function getCurrentLocalCalendarDateKey(
  now = new Date(),
): LocalCalendarDateKey {
  return createDateKey(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  )
}

function toCalendarDayOrdinal(dateKey: LocalCalendarDateKey): number {
  const match = LOCAL_DATE_PATTERN.exec(dateKey)
  if (!match) {
    throw new Error('A valid local calendar date key is required.')
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const ordinal = Date.UTC(year, month - 1, day) / MILLISECONDS_PER_CALENDAR_DAY
  const reconstructed = new Date(ordinal * MILLISECONDS_PER_CALENDAR_DAY)

  if (
    reconstructed.getUTCFullYear() !== year ||
    reconstructed.getUTCMonth() + 1 !== month ||
    reconstructed.getUTCDate() !== day
  ) {
    throw new Error('A valid local calendar date key is required.')
  }

  return ordinal
}

/** Count calendar boundaries without treating the period as elapsed hours. */
export function differenceInLocalCalendarDays(
  laterDate: LocalCalendarDateKey,
  earlierDate: LocalCalendarDateKey,
): number {
  return toCalendarDayOrdinal(laterDate) - toCalendarDayOrdinal(earlierDate)
}

/** Include today and the preceding six local dates, never future dates. */
export function isWithinRollingSevenLocalCalendarDays(
  recordDate: LocalCalendarDateKey,
  today: LocalCalendarDateKey,
): boolean {
  const calendarAge = differenceInLocalCalendarDays(today, recordDate)
  return calendarAge >= 0 && calendarAge <= 6
}
