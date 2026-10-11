import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { HomePage } from '../../../frontend/src/pages/HomePage'
import { IndexedDbDailyCheckInRepository as CheckIns } from '../../../frontend/src/features/drinks/storage/dailyCheckInRepository'
import { IndexedDbDrinkingRecordRepository as Drinks } from '../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import { IndexedDbAwardRepository } from '../../../frontend/src/features/awards/awardRepository'
import { getCurrentLocalCalendarDateKey as today } from '../../../frontend/src/features/drinks/utils/localCalendarDate'

it('shows an unrecorded day without creating a confirmation and links to today', async () => {
  window.history.replaceState({}, '', '/iteration3/')
  render(<HomePage />)
  await screen.findByText(/No check-in recorded today/)
  expect(screen.getByRole('link', { name: 'Record a drink' })).toHaveAttribute('href', '/iteration3/record?date=' + today())
  expect((await new CheckIns().initialize()).alcoholFreeDates).toEqual([])
})
it('persists No alcohol and awards across remounts', async () => {
  const view = render(<HomePage />)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'No alcohol' }))
  await screen.findByText(/Check-in complete — no alcohol today/)
  await waitFor(async () => expect(await new IndexedDbAwardRepository().list()).toHaveLength(2))
  expect(screen.queryByRole('button', { name: 'No alcohol' })).not.toBeInTheDocument()
  view.unmount()
  render(<HomePage />)
  expect(await screen.findByText(/Check-in complete — no alcohol today/)).toBeInTheDocument()
})
it('refreshes after adding and deleting a drink without inferring an alcohol-free day', async () => {
  await new CheckIns().confirmAlcoholFree(today())
  render(<HomePage />)
  await screen.findByText(/Check-in complete — no alcohol today/)
  const now = new Date()
  const repo = new Drinks()
  await repo.add({ id: 'home-test', drinkType: 'beer', drinkName: 'Beer', servingVolumeMl: 330, abvPercent: 5, amountConsumed: 1, consumedAt: now.toISOString(), consumedTimezoneOffsetMinutes: now.getTimezoneOffset(), createdAt: now.toISOString() })
  fireEvent.focus(window)
  await screen.findByText(/Check-in complete — drinking recorded today/)
  expect(screen.queryByRole('button', { name: 'No alcohol' })).not.toBeInTheDocument()
  await repo.delete('home-test')
  fireEvent.focus(window)
  expect(await screen.findByText(/No check-in recorded today/)).toBeInTheDocument()
})
it('reports save failure without showing completion', async () => {
  const spy = vi.spyOn(CheckIns.prototype, 'confirmAlcoholFree').mockRejectedValue(new Error('Disk full'))
  try {
    render(<HomePage />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'No alcohol' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm No alcohol')
    expect(screen.getByText(/No check-in recorded today/)).toBeInTheDocument()
  } finally { spy.mockRestore() }
})
it('allows retry after a read failure', async () => {
  const spy = vi.spyOn(CheckIns.prototype, 'initialize').mockRejectedValueOnce(new Error('Unavailable'))
  try {
    render(<HomePage />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Retry check-in' }))
    expect(await screen.findByText(/No check-in recorded today/)).toBeInTheDocument()
  } finally { spy.mockRestore() }
})
