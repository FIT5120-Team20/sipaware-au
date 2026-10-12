import { isReminderTime } from './reminderPreference'

export type ReminderTimeFormat = '12-hour' | '24-hour'

/** Display a saved HH:mm value without changing it or reading device state. */
export function formatReminderTime(time: string, format: ReminderTimeFormat = '12-hour'): string {
  if (!isReminderTime(time)) return ''
  if (format === '24-hour') return time
  const [hour, minute] = time.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}
