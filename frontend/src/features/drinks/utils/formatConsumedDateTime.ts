/**
 * Preserves and presents the local wall-clock time entered for an occasion.
 *
 * DrinkingRecord stores a portable ISO instant plus the offset at consumption.
 * These helpers reverse that conversion before editing or en-AU display so a
 * later viewer timezone does not change the time the user intended to record.
 */
import type { DrinkingRecord } from '../types/drinkingRecord'

// UTC formatting is intentional after getEnteredWallClockDate has shifted the
// instant back to the recorded wall clock; applying another timezone would
// reintroduce the display shift this module is designed to prevent.
const australianEnglishDateTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
})

/** Convert the ISO instant and stored offset back to entered clock components. */
function getEnteredWallClockDate(
  record: Pick<
    DrinkingRecord,
    'consumedAt' | 'consumedTimezoneOffsetMinutes'
  >,
): Date {
  const consumedAtMilliseconds = new Date(record.consumedAt).getTime()
  return new Date(
    consumedAtMilliseconds - record.consumedTimezoneOffsetMinutes * 60_000,
  )
}

function padDateTimePart(value: number): string {
  return String(value).padStart(2, '0')
}

/** Return stable YYYY-MM-DD/HH:mm strings for the correction form controls. */
export function getConsumedDateTimeInputValues(
  record: Pick<
    DrinkingRecord,
    'consumedAt' | 'consumedTimezoneOffsetMinutes'
  >,
): { date: string; time: string } {
  const enteredWallClockDate = getEnteredWallClockDate(record)

  return {
    date: `${enteredWallClockDate.getUTCFullYear()}-${padDateTimePart(
      enteredWallClockDate.getUTCMonth() + 1,
    )}-${padDateTimePart(enteredWallClockDate.getUTCDate())}`,
    time: `${padDateTimePart(
      enteredWallClockDate.getUTCHours(),
    )}:${padDateTimePart(enteredWallClockDate.getUTCMinutes())}`,
  }
}

/** Present the preserved occasion using application-controlled en-AU wording. */
export function formatConsumedDateTime(
  record: Pick<
    DrinkingRecord,
    'consumedAt' | 'consumedTimezoneOffsetMinutes'
  >,
): string {
  return australianEnglishDateTimeFormatter.format(
    getEnteredWallClockDate(record),
  )
}
