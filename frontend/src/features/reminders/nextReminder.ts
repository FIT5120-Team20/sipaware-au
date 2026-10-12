/** Format the acknowledged appointment, never a prediction from an unsaved input.
 * Calendar arithmetic uses the saved timezone; DST days need not last 24 hours. */
import type { PushStatus } from './pushClient'
import { formatReminderTime, type ReminderTimeFormat } from './formatReminderTime'

export function nextReminderLabel(status: PushStatus, now = new Date(), timeFormat: ReminderTimeFormat = '12-hour'): string {
  if (!status.enabled || status.needs_attention) return ''
  const unavailable = 'Next reminder could not be confirmed. Retry reminder status.'
  if (!status.next_due_at || !status.timezone) return unavailable
  const due = new Date(status.next_due_at)
  if (!Number.isFinite(due.getTime())) return unavailable
  if (due <= now) return 'Reminder time reached. Refresh status to see the next reminder.'
  try {
    const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: status.timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const parts = calendar.formatToParts(now)
    const part = (name: string) => Number(parts.find(p => p.type === name)?.value)
    // Build tomorrow's calendar label in UTC, avoiding DST/timezone conversion.
    const tomorrow = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + 1))
    const tomorrowKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrow)
    const day = calendar.format(due) === calendar.format(now) ? 'Today'
      : calendar.format(due) === tomorrowKey ? 'Tomorrow'
      : new Intl.DateTimeFormat('en-AU', { timeZone: status.timezone, day: 'numeric', month: 'short', year: 'numeric' }).format(due)
    const timeParts = new Intl.DateTimeFormat('en-AU', { timeZone: status.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(due)
    const hour = timeParts.find(p => p.type === 'hour')?.value ?? ''
    const minute = timeParts.find(p => p.type === 'minute')?.value ?? ''
    const time = formatReminderTime(`${hour}:${minute}`, timeFormat)
    if (!time) return unavailable
    const zone = status.timezone === Intl.DateTimeFormat().resolvedOptions().timeZone ? '' : ` (${status.timezone})`
    return `Next reminder: ${day} at ${time}${zone}`
  } catch { return unavailable }
}
