import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../../frontend/src/App'
import { AwardsPage } from '../../../frontend/src/features/awards/AwardsPage'
import { loadAwardOverview } from '../../../frontend/src/features/awards/awardOverview'
import { IndexedDbAwardRepository, closeAwardDatabase } from '../../../frontend/src/features/awards/awardRepository'
import { openCheckInDatabase } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'
import { applicationHref } from '../../../frontend/src/app/entryPaths'

async function seedFreeDays(count: number) {
  const db = await openCheckInDatabase()
  for (let index = 0; index < count; index++) {
    const date = `2026-01-${String(index + 1).padStart(2, '0')}`
    await db.put('daily_checkins', { id: 'day:' + date, kind: 'alcohol-free', date, confirmedAt: '2026-02-01T12:00:00.000Z' })
  }
}

describe('Awards page', () => {
  it('shows all six real awards with no invented progress or recent award', async () => {
    render(<AwardsPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(await screen.findByText('0 of 6 unlocked')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^View .+: Not earned yet$/ })).toHaveLength(6)
    expect(screen.queryByRole('heading', { name: 'Recently unlocked' })).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('evaluates real data, persists qualified awards and opens accessible details', async () => {
    await seedFreeDays(3)
    const user = userEvent.setup()
    render(<AwardsPage />)
    expect(await screen.findByText('2 of 6 unlocked')).toBeInTheDocument()
    expect(screen.getByText('3 of 5 days')).toBeInTheDocument()
    expect(screen.getByText('1 of 7 days')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View Keeping Track: In progress' }))
    const dialog = screen.getByRole('dialog', { name: 'Keeping Track' })
    expect(within(dialog).getByText(/same day count once/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await new IndexedDbAwardRepository().list()).toHaveLength(2)
  })
  it('retains earned awards after history deletion and database reopening', async () => {
    await seedFreeDays(5)
    await loadAwardOverview()
    await (await openCheckInDatabase()).clear('daily_checkins')
    await closeAwardDatabase()
    render(<AwardsPage />)
    expect(await screen.findByText('3 of 6 unlocked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View Alcohol-Free Progress: Earned' })).toBeInTheDocument()
    expect(screen.queryByText(/New award earned:/)).not.toBeInTheDocument()
  })
  it('shows storage errors and allows retry without fake earned progress', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockImplementation(loadAwardOverview)
    const user = userEvent.setup()
    render(<AwardsPage load={load} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded or saved')
    expect(screen.queryByText(/of 6 unlocked/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('0 of 6 unlocked')).toBeInTheDocument()
  })
  it('refreshes real progress when returning from another tab', async () => {
    render(<AwardsPage />)
    await screen.findByText('0 of 6 unlocked')
    await seedFreeDays(1)
    fireEvent(window, new Event('focus'))
    expect(await screen.findByText('2 of 6 unlocked')).toBeInTheDocument()
  })
  it('uses the active iteration route for navigation and direct loads', async () => {
    window.history.replaceState({}, '', '/iteration3/awards')
    expect(applicationHref('/awards')).toBe('/iteration3/awards')
    render(<App />)
    expect(await screen.findByText('0 of 6 unlocked')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Awards' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Awards' })).toHaveAttribute('href', '/iteration3/awards')
  })
  it('does not grant the Trends award just by opening Awards', async () => {
    await seedFreeDays(14)
    const result = await loadAwardOverview()
    expect(result.awards.find(award => award.id === 'know-your-patterns')?.status).toBe('not-earned')
    await waitFor(() => expect(result.newlyEarned).not.toContainEqual(expect.objectContaining({ id: 'know-your-patterns' })))
  })
})
