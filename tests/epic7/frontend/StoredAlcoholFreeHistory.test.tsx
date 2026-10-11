import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ManualDrinkPage } from '../../../frontend/src/features/drinks/pages/ManualDrinkPage'
import { loadAwardOverview } from '../../../frontend/src/features/awards/awardOverview'
import { openCheckInDatabase } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'
import { IndexedDbDailyCheckInRepository } from '../../../frontend/src/features/drinks/storage/dailyCheckInRepository'

it('preserves an explicit confirmation before first use for selected History details and earned awards', async () => {
  await new IndexedDbDailyCheckInRepository().confirmAlcoholFree('2025-12-31')
  window.history.replaceState({ checkInDate: '2025-12-31' }, '', '/iteration3/trends#history')
  render(<ManualDrinkPage initialView="history" />)
  expect(await screen.findByText('December 2025')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add a past check-in' })).not.toBeInTheDocument()
  expect(document.querySelectorAll('.history-day')).toHaveLength(1)
  const day = document.getElementById('history-day-2025-12-31')!
  expect(within(day).getByText('Alcohol-free day')).toBeInTheDocument()
  const saved = await (await openCheckInDatabase()).get('daily_checkins', 'day:2025-12-31')
  expect(saved).toMatchObject({ date: '2025-12-31', kind: 'alcohol-free' })
  expect((await loadAwardOverview()).awards.find(award => award.id === 'alcohol-free-start')?.status).toBe('earned')
})
