import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HistoricalCheckIn } from '../../../frontend/src/features/drinks/components/HistoricalCheckIn'
import { ManualDrinkPage } from '../../../frontend/src/features/drinks/pages/ManualDrinkPage'
import { loadAwardOverview } from '../../../frontend/src/features/awards/awardOverview'
import { openCheckInDatabase } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'

async function choose(date: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add a past check-in' }))
  fireEvent.change(screen.getByLabelText('Check-in date'), { target: { value: date } })
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  return user
}
function setup(extra = {}) {
  const onNoAlcohol = vi.fn().mockResolvedValue(undefined)
  const onAddDrink = vi.fn()
  render(<HistoricalCheckIn today="2026-10-08" drinkingDates={[]} alcoholFreeDates={[]} onNoAlcohol={onNoAlcohol} onAddDrink={onAddDrink} {...extra} />)
  return { onNoAlcohol, onAddDrink }
}

describe('past-date check-in entry', () => {
  it('only saves when explicitly choosing No alcohol, using the selected historical date', async () => {
    const actions = setup()
    const user = await choose('2025-12-31')
    expect(actions.onNoAlcohol).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /No alcohol/ }))
    expect(actions.onNoAlcohol).toHaveBeenCalledWith('2025-12-31')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('sends the chosen historical date to the existing drink flow', async () => {
    const actions = setup()
    const user = await choose('2026-09-01')
    await user.click(screen.getByRole('button', { name: /I drank/ }))
    expect(actions.onAddDrink).toHaveBeenCalledWith('2026-09-01')
  })
  it.each(['', '2026-10-08', '2026-10-09'])('rejects empty, today and future dates: %s', async date => {
    const actions = setup()
    await choose(date)
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a valid date before today')
    expect(screen.getByLabelText('Check-in date')).toHaveAttribute('max', '2026-10-07')
    expect(actions.onNoAlcohol).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Past check-in options' })).not.toBeInTheDocument()
  })
  it('clears old options when the selected date changes', async () => {
    setup()
    await choose('2026-09-01')
    fireEvent.change(screen.getByLabelText('Check-in date'), { target: { value: '2026-09-02' } })
    expect(screen.queryByRole('region', { name: 'Past check-in options' })).not.toBeInTheDocument()
  })
  it.each([{ drinkingDates: ['2026-09-01'] }, { alcoholFreeDates: ['2026-09-01'] }])('does not offer a duplicate or conflicting No alcohol entry: %j', async extra => {
    setup(extra)
    await choose('2026-09-01')
    expect(screen.queryByRole('button', { name: /No alcohol/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add drink' })).toBeInTheDocument()
  })
  it('keeps the dialog open with an error if saving fails', async () => {
    setup({ onNoAlcohol: vi.fn().mockRejectedValue(new Error('Could not save')) })
    const user = await choose('2026-09-01')
    await user.click(screen.getByRole('button', { name: /No alcohol/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This day could not be saved as alcohol-free')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('cancels without creating data', async () => {
    const actions = setup()
    const user = await choose('2026-09-01')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(actions.onNoAlcohol).not.toHaveBeenCalled()
    expect(actions.onAddDrink).not.toHaveBeenCalled()
  })
  it('backfills before first use through History and makes the date available to awards', async () => {
    window.history.replaceState({}, '', '/iteration3/trends#history')
    render(<ManualDrinkPage initialView="history" />)
    await screen.findByRole('button', { name: 'Add a past check-in' })
    const user = await choose('2025-12-31')
    await user.click(screen.getByRole('button', { name: /No alcohol/ }))
    expect(await screen.findByText('December 2025')).toBeInTheDocument()
    const day = document.getElementById('history-day-2025-12-31')!
    expect(within(day).getByText('Alcohol-free day')).toBeInTheDocument()
    const saved = await (await openCheckInDatabase()).get('daily_checkins', 'day:2025-12-31')
    expect(saved).toMatchObject({ date: '2025-12-31', kind: 'alcohol-free' })
    expect((await loadAwardOverview()).awards.find(award => award.id === 'alcohol-free-start')?.status).toBe('earned')
  })
})
