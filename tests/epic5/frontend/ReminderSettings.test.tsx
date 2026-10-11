/** Exercise PR41's actual settings page and shared acknowledgement state.
 * Network operations are mocked; this does not prove OS notification display. */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReminderSettings } from '../../../frontend/src/features/reminders/ReminderSettings'
import { refreshRecordingReminder } from '../../../frontend/src/features/reminders/recordingReminderState'
import { disablePush, enablePush, pushCapabilities, pushStatus, type PushStatus } from '../../../frontend/src/features/reminders/pushClient'
import { REMINDER_PREFERENCE_KEY, readReminderPreference, saveReminderPreference } from '../../../frontend/src/features/reminders/reminderPreference'
vi.mock('../../../frontend/src/features/reminders/pushClient', () => ({ disablePush: vi.fn(), enablePush: vi.fn(), pushCapabilities: vi.fn(), pushStatus: vi.fn(), PUSH_CHANGED: 'push-test-changed' }))
vi.mock('../../../frontend/src/features/reminders/ReminderSuggestionPrompt', () => ({ ReminderSuggestionPrompt: () => null }))
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
const active = (time = '20:30'): PushStatus => ({ saved: true, enabled: true, time, timezone: zone, next_due_at: new Date(Date.now() + 3600000).toISOString() })
beforeEach(async () => {
  localStorage.removeItem(REMINDER_PREFERENCE_KEY)
  vi.resetAllMocks()
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('Notification', { permission: 'granted' })
  vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} })
  vi.mocked(pushStatus).mockResolvedValue({ saved: false, enabled: false, time: null, timezone: null })
  vi.mocked(pushCapabilities).mockResolvedValue({ available: true, publicKey: 'synthetic' })
  await act(async () => { await refreshRecordingReminder() })
})
afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(REMINDER_PREFERENCE_KEY) })
async function open(status: PushStatus = { saved: false, enabled: false, time: null, timezone: null }) {
  vi.mocked(pushStatus).mockResolvedValue(status)
  render(<ReminderSettings />)
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Daily reminder' })).toBeEnabled())
}
async function choose(time: string) {
  const input = screen.getByLabelText('Reminder time')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: time } })
  await act(async () => { fireEvent.blur(input) })
}
it('saves one preference while off without enabling server delivery', async () => {
  await open()
  await choose('20:30')
  expect(readReminderPreference()?.time).toBe('20:30')
  await choose('09:00')
  expect(readReminderPreference()?.time).toBe('09:00')
  expect(enablePush).not.toHaveBeenCalled()
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','false')
  expect(screen.queryByText(/Next reminder:/)).not.toBeInTheDocument()
})
it('editing alone does not save a draft before blur', async () => {
  saveReminderPreference('18:00')
  await open()
  fireEvent.focus(screen.getByLabelText('Reminder time'))
  fireEvent.change(screen.getByLabelText('Reminder time'), { target: { value: '19:00' } })
  expect(readReminderPreference()?.time).toBe('18:00')
  expect(enablePush).not.toHaveBeenCalled()
})
it.each(['', '24:00', '12:60', '9:00'])('rejects invalid time %s', value => {
  expect(() => saveReminderPreference(value)).toThrow()
  expect(readReminderPreference()).toBeNull()
})
it('reports storage failure without a saved confirmation', async () => {
  await open()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Full') })
  await choose('20:00')
  expect(screen.getByRole('alert')).toHaveTextContent('could not be saved')
  expect(screen.queryByText('Reminder time saved.')).not.toBeInTheDocument()
})
it('reports corrupt saved data without silently resetting it', async () => {
  localStorage.setItem(REMINDER_PREFERENCE_KEY, '{broken')
  await open()
  expect(screen.getByRole('alert')).toHaveTextContent('could not be read')
  expect(localStorage.getItem(REMINDER_PREFERENCE_KEY)).toBe('{broken')
})
it('shows acknowledged next occurrence; unchanged save and focus never rearm', async () => {
  await open(active())
  expect(await screen.findByText(/Next reminder:/)).toBeInTheDocument()
  await choose('20:30')
  await act(async () => { window.dispatchEvent(new Event('focus')) })
  expect(enablePush).not.toHaveBeenCalled()
})
it('an explicit new time replaces the appointment only after acknowledgement', async () => {
  await open(active())
  let finish!: (status: PushStatus) => void
  vi.mocked(enablePush).mockReturnValue(new Promise(resolve => { finish = resolve }))
  const input = screen.getByLabelText('Reminder time')
  fireEvent.change(input,{ target: { value: '20:31' } })
  fireEvent.blur(input)
  await waitFor(() => expect(enablePush).toHaveBeenCalledWith('20:31'))
  expect(screen.queryByText(/Next reminder:/)).not.toBeInTheDocument()
  await act(async () => { finish(active('20:31')) })
  expect(await screen.findByText('Reminder time updated.')).toBeInTheDocument()
  expect(screen.getByLabelText('Reminder time')).toHaveValue('20:31')
  expect(screen.getByText(/Next reminder:/)).toBeInTheDocument()
})
it('failed changes retain the last confirmed setting and expose the error', async () => {
  await open(active())
  vi.mocked(enablePush).mockRejectedValue(new Error('Connection unavailable'))
  await choose('20:31')
  expect(screen.getByRole('alert')).toHaveTextContent('Connection unavailable')
  expect(screen.getByLabelText('Reminder time')).toHaveValue('20:30')
  expect(screen.queryByText('Reminder time updated.')).not.toBeInTheDocument()
})
it('unverifiable status hides the appointment instead of claiming success', async () => {
  await open(active())
  vi.mocked(pushStatus).mockRejectedValue(new Error('offline'))
  await act(async () => { await refreshRecordingReminder() })
  expect(screen.queryByText(/Next reminder:/)).not.toBeInTheDocument()
  expect(screen.getByText(/status could not be confirmed/)).toBeInTheDocument()
})
it('turning off removes the next occurrence after server confirmation', async () => {
  await open(active())
  vi.mocked(disablePush).mockResolvedValue({ saved: true, enabled: false, time: null, timezone: null })
  await act(async () => { fireEvent.click(screen.getByRole('switch')) })
  expect(disablePush).toHaveBeenCalledOnce()
  expect(screen.queryByText(/Next reminder:/)).not.toBeInTheDocument()
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','false')
})
