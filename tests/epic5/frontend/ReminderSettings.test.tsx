import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReminderSettings } from '../../../frontend/src/features/reminders/ReminderSettings'
import { REMINDER_PREFERENCE_KEY, readReminderPreference, saveReminderPreference } from '../../../frontend/src/features/reminders/reminderPreference'
vi.mock('../../../frontend/src/features/reminders/PushSettingsControl', () => ({ PushSettingsControl: () => null }))
beforeEach(() => localStorage.removeItem(REMINDER_PREFERENCE_KEY))
afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(REMINDER_PREFERENCE_KEY) })
async function open() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Recording reminder settings' }))
  return user
}
it('saves and replaces one preference across reopening without claiming notifications are enabled', async () => {
  render(<ReminderSettings />)
  const user = await open()
  fireEvent.change(screen.getByLabelText('Preferred daily reminder time'), { target: { value: '20:30' } })
  await user.click(screen.getByRole('button', { name: 'Save preferred time' }))
  expect(screen.getByRole('status')).toHaveTextContent('Background reminder settings are unchanged')
  expect(readReminderPreference()?.time).toBe('20:30')
  await user.click(screen.getByRole('button', { name: 'Close' }))
  await open()
  expect(screen.getByLabelText('Preferred daily reminder time')).toHaveValue('20:30')
  fireEvent.change(screen.getByLabelText('Preferred daily reminder time'), { target: { value: '09:00' } })
  await user.click(screen.getByRole('button', { name: 'Save preferred time' }))
  expect(readReminderPreference()?.time).toBe('09:00')
  await user.click(screen.getByRole('button', { name: 'Remove saved time' }))
  expect(readReminderPreference()).toBeNull()
})
it('closing without saving leaves the stored time unchanged', async () => {
  saveReminderPreference('18:00')
  render(<ReminderSettings />)
  const user = await open()
  fireEvent.change(screen.getByLabelText('Preferred daily reminder time'), { target: { value: '19:00' } })
  await user.click(screen.getByRole('button', { name: 'Close' }))
  expect(readReminderPreference()?.time).toBe('18:00')
})
it.each(['', '24:00', '12:60', '9:00'])('rejects invalid time %s', value => {
  expect(() => saveReminderPreference(value)).toThrow()
  expect(readReminderPreference()).toBeNull()
})
it('reports storage failure without a saved confirmation', async () => {
  render(<ReminderSettings />)
  const user = await open()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full') })
  fireEvent.change(screen.getByLabelText('Preferred daily reminder time'), { target: { value: '20:00' } })
  await user.click(screen.getByRole('button', { name: 'Save preferred time' }))
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
it('reports corrupt saved data without silently resetting it', async () => {
  localStorage.setItem(REMINDER_PREFERENCE_KEY, '{broken')
  render(<ReminderSettings />)
  await open()
  expect(screen.getByRole('alert')).toHaveTextContent('could not be read')
  expect(localStorage.getItem(REMINDER_PREFERENCE_KEY)).toBe('{broken')
})
