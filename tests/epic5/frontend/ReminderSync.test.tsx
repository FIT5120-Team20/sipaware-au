/** Fake timers distinguish event/midnight synchronization from constant
 * polling and ensure failed requests have visible, bounded retries. */
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { act, render, screen, cleanup } from '@testing-library/react'
import { ReminderSync } from '../../../frontend/src/features/reminders/ReminderSync'
import { ReminderRequestError, syncPushState } from '../../../frontend/src/features/reminders/pushClient'
import { setReminderSyncNotice } from '../../../frontend/src/features/reminders/reminderSyncState'
vi.mock('../../../frontend/src/features/reminders/pushClient',async importOriginal=>({
  ...await importOriginal<typeof import('../../../frontend/src/features/reminders/pushClient')>(),
  syncPushState:vi.fn(),
}))
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,11,12))
  vi.mocked(syncPushState).mockReset().mockResolvedValue(undefined)
  setReminderSyncNotice(null)
})
afterEach(()=>{cleanup();vi.useRealTimers();setReminderSyncNotice(null)})

it('does not poll every minute while the page remains unchanged',async()=>{
  render(<ReminderSync />)
  await act(async()=>{await vi.advanceTimersByTimeAsync(10*60000)})
  expect(syncPushState).toHaveBeenCalledTimes(1)
  await act(async()=>{window.dispatchEvent(new Event('sipaware:history-committed'))})
  expect(syncPushState).toHaveBeenCalledTimes(2)
})

it('shows failed synchronization and stops after four retries',async()=>{
  vi.mocked(syncPushState).mockRejectedValue(new Error('Offline'))
  render(<ReminderSync />)
  await act(async()=>{await vi.advanceTimersByTimeAsync(10*60000)})
  expect(syncPushState).toHaveBeenCalledTimes(5)
  expect(screen.getByRole('status')).toHaveTextContent('Reminder status has not synced')
  expect(screen.getByRole('button',{name:'Retry reminder sync'})).toBeInTheDocument()
  vi.mocked(syncPushState).mockResolvedValue(undefined)
  await act(async()=>{window.dispatchEvent(new Event('online'))})
  expect(screen.queryByRole('status')).toBeNull()
})

it('does not repeatedly retry an expired website login',async()=>{
  vi.mocked(syncPushState).mockRejectedValue(new ReminderRequestError('Please sign in again.',false))
  render(<ReminderSync />)
  await act(async()=>{await vi.advanceTimersByTimeAsync(10*60000)})
  expect(syncPushState).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status')).toHaveTextContent('sign in again')
})

it('synchronizes a new local day once without a continuous timer',async()=>{
  vi.setSystemTime(new Date(2026,9,11,23,59,59))
  render(<ReminderSync />)
  await act(async()=>{await vi.advanceTimersByTimeAsync(3000)})
  expect(syncPushState).toHaveBeenCalledTimes(2)
})
