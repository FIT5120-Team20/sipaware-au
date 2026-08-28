import type { DrinkingRecord } from '../types/drinkingRecord'

const australianEnglishDateTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
})

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
