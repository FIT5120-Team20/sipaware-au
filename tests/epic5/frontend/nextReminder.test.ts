/** Server appointments must be described by their saved local calendar, including
 * midnight, year changes and DST. No guessed schedule when metadata is absent. */
import { expect, it } from 'vitest'
import { nextReminderLabel } from '../../../frontend/src/features/reminders/nextReminder'
import type { PushStatus } from '../../../frontend/src/features/reminders/pushClient'
const status = (due: string, timezone = 'Australia/Sydney'): PushStatus => ({ saved: true, enabled: true, time: '00:59', timezone, next_due_at: due })
it('shows Today for a later time on the same Sydney day', () => {
  expect(nextReminderLabel(status('2026-10-11T13:59:00Z'), new Date('2026-10-11T13:58:00Z'))).toContain('Today at 12:59 AM')
})
it('shows Tomorrow across local midnight and year boundaries', () => {
  expect(nextReminderLabel(status('2026-12-31T13:59:00Z'), new Date('2026-12-31T12:58:00Z'))).toContain('Tomorrow at 12:59 AM')
})
it.each(['2026-10-03T15:00:00Z', '2026-04-04T17:00:00Z'])('uses the calendar rather than 24-hour arithmetic on DST day %s', now => {
  const due = now.startsWith('2026-10') ? '2026-10-04T13:59:00Z' : '2026-04-05T14:59:00Z'
  expect(nextReminderLabel(status(due), new Date(now))).toContain('Tomorrow at 12:59 AM')
})
it('shows an explicit date for an appointment beyond tomorrow', () => {
  expect(nextReminderLabel(status('2026-10-14T13:59:00Z'), new Date('2026-10-11T13:58:00Z'))).toContain('15 Oct 2026')
})
it('never invents a future appointment from invalid or elapsed metadata', () => {
  expect(nextReminderLabel(status('bad'))).toContain('could not be confirmed')
  expect(nextReminderLabel(status('2026-10-11T13:59:00Z'), new Date('2026-10-11T13:59:00Z'))).toContain('time reached')
  expect(nextReminderLabel(status('2099-01-01T00:00:00Z','bad-zone'))).toContain('could not be confirmed')
  expect(nextReminderLabel({ saved: true, enabled: true, time: null, timezone: null })).toContain('could not be confirmed')
  expect(nextReminderLabel({ ...status('2099-01-01T00:00:00Z'), enabled: false })).toBe('')
  expect(nextReminderLabel({ ...status('2099-01-01T00:00:00Z'), needs_attention: true })).toBe('')
})
