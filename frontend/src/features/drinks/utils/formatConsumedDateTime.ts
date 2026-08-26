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

export function formatConsumedDateTime(
  record: Pick<
    DrinkingRecord,
    'consumedAt' | 'consumedTimezoneOffsetMinutes'
  >,
): string {
  const consumedAtMilliseconds = new Date(record.consumedAt).getTime()
  const enteredLocalDate = new Date(
    consumedAtMilliseconds - record.consumedTimezoneOffsetMinutes * 60_000,
  )

  return australianEnglishDateTimeFormatter.format(enteredLocalDate)
}
