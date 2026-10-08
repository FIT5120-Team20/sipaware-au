import { expect, it } from 'vitest'
import { evaluateReminder, type ReminderDecisionInput } from '../../../frontend/src/features/reminders/reminderRules'
const base: ReminderDecisionInput = { today: '2026-10-09', localTime: '20:00', preferredTime: '20:00', enabled: true, deliveryReady: true, historyLoaded: true, todayCheckIn: 'unrecorded', sentDates: [] }
it.each(['20:00', '20:01', '23:59'])('allows one eligible daily reminder at %s', localTime => {
  expect(evaluateReminder({ ...base, localTime })).toEqual({ eligible: true, reason: 'due' })
})
it.each([
  [{ enabled: false }, 'disabled'],
  [{ deliveryReady: false }, 'delivery-unavailable'],
  [{ historyLoaded: false }, 'history-unavailable'],
  [{ todayCheckIn: 'drinks' }, 'checked-in'],
  [{ todayCheckIn: 'alcohol-free' }, 'checked-in'],
  [{ localTime: '19:59' }, 'before-time'],
  [{ sentDates: ['2026-10-09'] }, 'already-sent'],
] as const)('suppresses when %j', (change, reason) => {
  expect(evaluateReminder({ ...base, ...change })).toEqual({ eligible: false, reason })
})
it.each([
  { today: '2026-02-30' }, { localTime: '24:00' }, { preferredTime: '9:00' },
  { preferredTime: '' }, { sentDates: ['not-a-date'] },
])('fails closed for invalid input %j', change => {
  expect(evaluateReminder({ ...base, ...change })).toEqual({ eligible: false, reason: 'invalid-input' })
})
it('a prior-day delivery does not block today, including a midnight reminder', () => {
  expect(evaluateReminder({ ...base, localTime: '00:00', preferredTime: '00:00', sentDates: ['2026-10-08'] }).eligible).toBe(true)
})
it('changing reminder time or re-enabling does not bypass the daily limit', () => {
  expect(evaluateReminder({ ...base, preferredTime: '21:00', localTime: '21:00', sentDates: [base.today] }).reason).toBe('already-sent')
})
it('retains protection if the clock returns to an earlier delivered date', () => {
  expect(evaluateReminder({ ...base, sentDates: [base.today, '2026-10-10'] }).reason).toBe('already-sent')
})
it('does not mutate the scheduler snapshot or record a delivery', () => {
  const snapshot = { ...base, sentDates: [] }
  const before = JSON.stringify(snapshot)
  evaluateReminder(snapshot)
  expect(JSON.stringify(snapshot)).toBe(before)
})
