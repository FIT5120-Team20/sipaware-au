import { isCalendarDate } from '../drinks/types/dailyCheckIn'
import { isReminderTime } from './reminderPreference'

export interface ReminderDecisionInput {
  // The scheduler supplies a single timezone-consistent snapshot, not UTC dates.
  today: string
  localTime: string
  preferredTime: string
  enabled: boolean
  deliveryReady: boolean
  historyLoaded: boolean
  todayCheckIn: 'unrecorded' | 'drinks' | 'alcohol-free'
  // Persistent delivery ledger dates; a last-sent timestamp alone cannot prevent
  // duplicates when users travel or change their device date backwards.
  sentDates: readonly string[]
}
export type ReminderDecision = {
  eligible: boolean
  reason: 'invalid-input' | 'disabled' | 'delivery-unavailable' | 'history-unavailable'
    | 'already-sent' | 'checked-in' | 'before-time' | 'due'
}

/** Eligibility only. The delivery layer must atomically claim a day before sending.
 * No timers, notifications, database writes, or synthetic check-ins happen here.
 * A late scheduler may send once later on the same day, never replay prior days.
 */
export function evaluateReminder(input: ReminderDecisionInput): ReminderDecision {
  const no = (reason: ReminderDecision['reason']): ReminderDecision => ({ eligible: false, reason })
  if (!isCalendarDate(input.today) || !isReminderTime(input.localTime)
    || !isReminderTime(input.preferredTime) || !Array.isArray(input.sentDates)
    || input.sentDates.some(date => !isCalendarDate(date))
    || !['unrecorded', 'drinks', 'alcohol-free'].includes(input.todayCheckIn)) return no('invalid-input')
  if (input.enabled !== true) return no('disabled')
  if (input.deliveryReady !== true) return no('delivery-unavailable')
  if (input.historyLoaded !== true) return no('history-unavailable')
  if (input.sentDates.includes(input.today)) return no('already-sent')
  if (input.todayCheckIn !== 'unrecorded') return no('checked-in')
  if (input.localTime < input.preferredTime) return no('before-time')
  return { eligible: true, reason: 'due' }
}
