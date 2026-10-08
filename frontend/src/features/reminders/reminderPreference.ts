/** A saved preference is not an active notification subscription. */
export const REMINDER_PREFERENCE_KEY = 'sipaware.reminder-preference.v1'
export interface ReminderPreference { version: 1; time: string }
export function isReminderTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}
export function readReminderPreference(): ReminderPreference | null {
  const raw = window.localStorage.getItem(REMINDER_PREFERENCE_KEY)
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1
    || !('time' in value) || typeof value.time !== 'string' || !isReminderTime(value.time)) {
    throw new Error('Invalid saved reminder preference')
  }
  return { version: 1, time: value.time }
}
export function saveReminderPreference(time: string): void {
  if (!isReminderTime(time)) throw new Error('Choose a valid time')
  window.localStorage.setItem(REMINDER_PREFERENCE_KEY, JSON.stringify({ version: 1, time }))
}
export function clearReminderPreference(): void {
  window.localStorage.removeItem(REMINDER_PREFERENCE_KEY)
}
