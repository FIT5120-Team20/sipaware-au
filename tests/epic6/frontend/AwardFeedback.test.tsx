import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../../frontend/src/App'
import { IndexedDbAwardRepository } from '../../../frontend/src/features/awards/awardRepository'
import { updateAwardsAfterCheckIn, AWARD_FEEDBACK_EVENT } from '../../../frontend/src/features/awards/awardFeedbackEvents'
import { openCheckInDatabase } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'

function seed() {
  return openCheckInDatabase().then(db => db.put('daily_checkins', {
    id: 'day:2026-01-01', kind: 'alcohol-free', date: '2026-01-01', confirmedAt: '2026-01-02T12:00:00.000Z',
  }))
}

describe('automatic award feedback', () => {
  it('grants immediately after No alcohol and keeps feedback across the History navigation', async () => {
    window.history.replaceState({}, '', '/iteration3/record')
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /No alcohol today/ }))
    expect(await screen.findByText(/New award earned: Small Step, Alcohol-Free Start/)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/iteration3/trends')
    expect(await new IndexedDbAwardRepository().list()).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'View Awards' })).toHaveAttribute('href', '/iteration3/awards')
    await user.click(screen.getByRole('button', { name: 'Dismiss award notification' }))
    expect(screen.queryByText(/New award earned:/)).not.toBeInTheDocument()
  })
  it('does not announce the same award again on repeated evaluation', async () => {
    await seed()
    const listener = vi.fn()
    window.addEventListener(AWARD_FEEDBACK_EVENT, listener)
    try {
      await updateAwardsAfterCheckIn()
      await updateAwardsAfterCheckIn()
      expect(listener).toHaveBeenCalledTimes(1)
    } finally { window.removeEventListener(AWARD_FEEDBACK_EVENT, listener) }
  })
  it('reports award storage failure without rejecting an already committed history write', async () => {
    await seed()
    const spy = vi.spyOn(IndexedDbAwardRepository.prototype, 'grant').mockRejectedValue(new Error('Disk full'))
    const listener = vi.fn()
    window.addEventListener(AWARD_FEEDBACK_EVENT, listener)
    try {
      await expect(updateAwardsAfterCheckIn()).resolves.toBeUndefined()
      expect(listener.mock.calls[0][0].detail).toMatchObject({ failed: true, message: expect.stringContaining('Do not record the same entry again') })
      expect(await (await openCheckInDatabase()).get('daily_checkins', 'day:2026-01-01')).toBeDefined()
    } finally { spy.mockRestore(); window.removeEventListener(AWARD_FEEDBACK_EVENT, listener) }
  })
})

  // The seven-day threshold counts represented dates, including backfilled No alcohol.
  it.each([6, 7])('grants Know Your Patterns only on an actual Trends view with %s dates', async count => {
    const db = await openCheckInDatabase()
    for (let index = 1; index <= count; index++) {
      const date = `2026-01-${String(index).padStart(2, '0')}`
      await db.put('daily_checkins', { id: 'day:' + date, kind: 'alcohol-free', date, confirmedAt: '2026-02-01T12:00:00.000Z' })
    }
    window.history.replaceState({}, '', '/iteration3/trends#history')
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Your drinking records' })
    expect((await new IndexedDbAwardRepository().list()).some(row => row.id === 'know-your-patterns')).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Trends' }))
    if (count === 7) {
      expect(await screen.findByText(/New award earned:.*Know Your Patterns/)).toBeInTheDocument()
      expect((await new IndexedDbAwardRepository().list()).some(row => row.id === 'know-your-patterns')).toBe(true)
    } else {
      // Await the first-check-in award as evidence the async evaluation completed.
      await screen.findByText(/New award earned:/)
      expect((await new IndexedDbAwardRepository().list()).some(row => row.id === 'know-your-patterns')).toBe(false)
    }
  })
