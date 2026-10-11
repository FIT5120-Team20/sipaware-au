import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { HomePage } from '../../../frontend/src/pages/HomePage'
import { IndexedDbDailyCheckInRepository } from '../../../frontend/src/features/drinks/storage/dailyCheckInRepository'
import { IndexedDbDrinkingRecordRepository } from '../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import { IndexedDbAwardRepository } from '../../../frontend/src/features/awards/awardRepository'
import { openCheckInDatabase } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'
import { REMINDER_PREFERENCE_KEY, readReminderPreference, saveReminderPreference } from '../../../frontend/src/features/reminders/reminderPreference'

afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(REMINDER_PREFERENCE_KEY) })

it('shows a static wordmark hero and exactly five approved feature actions within Iteration 3', () => {
  window.history.replaceState({}, '', '/iteration3/')
  render(<HomePage />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SipAware')
  const actions = within(screen.getByRole('region', { name: 'What you can do here' }))
  expect(actions.getAllByRole('link')).toHaveLength(4)
  expect(actions.getAllByRole('button')).toHaveLength(1)
  const expected = [
    ['Record your drinks', 'Understand what you’re drinking', '/iteration3/record'],
    ['Learn about alcohol', 'Alcohol, ageing and guidelines', '/iteration3/alcohol-guidelines'],
    ['Understand your patterns', 'Review your drinking over time', '/iteration3/trends'],
    ['Set a reminder', 'Set a time for your daily check-in', null],
    ['Earn awards', 'Celebrate your progress and milestones', '/iteration3/awards'],
  ]
  const entries = document.querySelectorAll('.home-feature-card')
  expect(entries).toHaveLength(5)
  expected.forEach(([title, subtitle, href], index) => {
    expect(entries[index]).toHaveTextContent(title!)
    expect(entries[index]).toHaveTextContent(subtitle!)
    if (href) expect(entries[index]).toHaveAttribute('href', href)
  })
  expect(screen.queryByRole('button', { name: 'About this app' })).not.toBeInTheDocument()
  expect(screen.queryByText('Today’s check-in')).not.toBeInTheDocument()
  expect(screen.queryByText(/Achievements/)).not.toBeInTheDocument()
  expect(document.querySelector('.home-story-grid')).toBeNull()
  expect(document.querySelector('.home-hero a, .home-hero button')).toBeNull()
})

it('opens the existing settings from the feature row, preserves a time across reopening and keeps notifications off', async () => {
  render(<HomePage />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /Set a reminder/ }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Notifications are off.')
  fireEvent.change(screen.getByLabelText('Preferred daily reminder time'), { target: { value: '20:30' } })
  await user.click(screen.getByRole('button', { name: 'Save preferred time' }))
  expect(readReminderPreference()?.time).toBe('20:30')
  expect(screen.getByRole('status')).toHaveTextContent('Notifications are not enabled')
  await user.click(screen.getByRole('button', { name: 'Close' }))
  await user.click(screen.getByRole('button', { name: /Set a reminder/ }))
  expect(screen.getByLabelText('Preferred daily reminder time')).toHaveValue('20:30')
  expect(screen.queryByRole('button', { name: 'Recording reminder settings' })).not.toBeInTheDocument()
})

it('retains time suggestions inside settings and immediately reflects an accepted suggestion in the existing form', async () => {
  const db = await openCheckInDatabase()
  for (let i = 1; i <= 7; i++) {
    const date = '2026-01-0' + i
    await db.put('daily_checkins', { id: 'day:' + date, kind: 'alcohol-free', date, confirmedAt: new Date(2026, 0, i, 20).toISOString() })
  }
  saveReminderPreference('18:00')
  render(<HomePage />)
  const user = userEvent.setup()
  expect(screen.queryByRole('region', { name: 'Suggested reminder time' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Set a reminder/ }))
  await user.click(await screen.findByRole('button', { name: 'Save suggested time 20:00' }))
  expect(readReminderPreference()?.time).toBe('20:00')
  expect(screen.getByLabelText('Preferred daily reminder time')).toHaveValue('20:00')
  expect(screen.getByText('Saved time: 20:00')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Notifications are still off')
})

it('does not write check-ins, drinks or awards when visiting Home', async () => {
  const checkIns = new IndexedDbDailyCheckInRepository()
  const drinks = new IndexedDbDrinkingRecordRepository()
  const awards = new IndexedDbAwardRepository()
  await checkIns.confirmAlcoholFree('2026-01-01')
  const initial = await checkIns.initialize()
  const awardList = await awards.list()
  render(<HomePage />)
  expect(await checkIns.initialize()).toEqual(initial)
  expect(await drinks.list()).toEqual([])
  expect(await awards.list()).toEqual(awardList)
})
