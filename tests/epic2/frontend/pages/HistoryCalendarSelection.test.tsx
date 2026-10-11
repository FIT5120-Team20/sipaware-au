import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../../frontend/src/App'
import { IndexedDbDrinkingRecordRepository } from '../../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import { IndexedDbDailyCheckInRepository } from '../../../../frontend/src/features/drinks/storage/dailyCheckInRepository'
import { openCheckInDatabase } from '../../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'
import { getRecordLocalCalendarDateKey } from '../../../../frontend/src/features/drinks/utils/localCalendarDate'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 18, 20))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.localStorage.setItem('sipaware.record-help.seen.v1', '1')
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
const instruction = 'Select a date on the calendar to view your records.'
function record(id: string, day: number, total = 1, month = 9): DrinkingRecord {
  const date = new Date(2026, month, day, 18)
  return { id, recordSource: 'manual', drinkType: 'beer', drinkName: 'Saved ' + id, servingVolumeMl: 1000, abvPercent: 1,
    amountConsumed: total / .789, consumedAt: date.toISOString(), consumedTimezoneOffsetMinutes: date.getTimezoneOffset(), createdAt: date.toISOString() }
}
async function seed(records: DrinkingRecord[] = [], freeDates: string[] = []) {
  const repository = new IndexedDbDrinkingRecordRepository()
  for (const item of records) await repository.add(item)
  const checkIns = new IndexedDbDailyCheckInRepository()
  for (const date of freeDates) await checkIns.confirmAlcoholFree(date)
  return { repository, checkIns }
}
async function calendar() {
  window.history.replaceState({}, '', '/iteration3/trends#history')
  const view = render(<App />)
  await screen.findByRole('table', { name: /calendar$/ })
  return view
}
const cell = (date: string) => document.querySelector<HTMLButtonElement>('.history-calendar-day[data-date="' + date + '"]')!
const detail = () => screen.getByRole('region', { name: 'Selected day records' })
function noOldHistory() {
  expect(screen.queryByRole('navigation', { name: 'History pages' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Daily History' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Back to Calendar|Add a past check-in|Add entry|Add drink|No alcohol today|I drank/ })).not.toBeInTheDocument()
  expect(document.querySelector('.history-backfill, .history-past-form')).toBeNull()
  expect(document.querySelectorAll('.history-day').length).toBeLessThanOrEqual(1)
}

describe('calendar selection and inline day details', () => {
  it('shows the complete month and four raw-precision states, then selects only one day without navigation', async () => {
    await seed([record('below', 5, 3.999), record('above', 6, 4.001), record('part-a', 7, 2), record('part-b', 7, 2)], ['2026-10-04'])
    await calendar()
    expect(screen.getAllByRole('columnheader').map(heading => heading.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(document.querySelectorAll('.history-calendar-day')).toHaveLength(31)
    expect(cell('2026-10-01').closest('td')?.cellIndex).toBe(3)
    await waitFor(() => expect(cell('2026-10-05')).toHaveAttribute('data-status', 'within'))
    expect(cell('2026-10-06')).toHaveAttribute('data-status', 'above')
    expect(cell('2026-10-07')).toHaveAttribute('data-status', 'within')
    expect(cell('2026-10-04')).toHaveAttribute('data-status', 'alcohol-free')
    expect(cell('2026-10-03')).toHaveAttribute('data-status', 'unrecorded')
    expect(within(screen.getByRole('list', { name: 'Calendar legend' })).getAllByRole('listitem').map(item => item.textContent))
      .toEqual(['Above guideline', 'Within guideline', 'Alcohol-free'])
    expect(screen.getByText(instruction)).toBeVisible()
    expect(document.querySelectorAll('.history-calendar-day[aria-pressed="true"]')).toHaveLength(0)
    expect(document.querySelectorAll('.history-day')).toHaveLength(0)
    const url = window.location.href, historyLength = window.history.length
    fireEvent.click(cell('2026-10-07'))
    expect(window.location.href).toBe(url); expect(window.history.length).toBe(historyLength)
    expect(cell('2026-10-07')).toHaveAttribute('aria-pressed', 'true')
    expect(within(detail()).getByText('Saved part-a')).toBeVisible()
    expect(within(detail()).getByText('Saved part-b')).toBeVisible()
    expect(document.querySelector('.history-day-total')).toHaveTextContent('4.0standard drinks')
    expect(document.querySelector('.history-day[data-status]')).toBeNull()
    expect(screen.queryByText('Saved above')).not.toBeInTheDocument()
    fireEvent.click(cell('2026-10-04'))
    expect(within(detail()).getByText('Alcohol-free day')).toBeVisible()
    expect(document.querySelector('.history-day-total')).toHaveTextContent('0.0')
    expect(document.querySelectorAll('.history-record')).toHaveLength(0)
    noOldHistory()
  })

  it.each(['drinking', 'alcohol-free'] as const)('automatically selects today when it has saved %s data', async kind => {
    await seed(kind === 'drinking' ? [record('today', 18, 2)] : [], kind === 'alcohol-free' ? ['2026-10-18'] : [])
    const view = await calendar()
    expect(cell('2026-10-18')).toHaveAttribute('aria-current', 'date')
    expect(cell('2026-10-18')).toHaveAttribute('aria-pressed', 'true')
    expect(cell('2026-10-18')).toHaveClass('history-calendar-day--today', 'history-calendar-day--selected')
    expect(document.querySelector('.history-day-total')).toHaveTextContent(kind === 'drinking' ? '2.0' : '0.0')
    view.unmount(); render(<App />)
    await screen.findByRole('table', { name: /calendar$/ })
    expect(cell('2026-10-18')).toHaveAttribute('aria-pressed', 'true')
    noOldHistory()
  })

  it.each(['http', 'network', 'invalid'] as const)('leaves drinking days pending comparison on a %s guideline API failure', async failure => {
    const records = [record('below', 5, 3.999), record('exact', 6, 4), record('above', 7, 4.001), record('part-a', 8, 2), record('part-b', 8, 2.001)]
    const { repository, checkIns } = await seed(records, ['2026-10-04'])
    const publicReferenceFetch = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.endsWith('/api/reference/alcohol-guidelines')) {
        if (failure === 'network') throw new TypeError('Network request failed')
        if (failure === 'invalid') return new Response(JSON.stringify({ guidelines: [] }), { status: 200 })
        return new Response(null, { status: 503 })
      }
      return publicReferenceFetch(input, init)
    })
    await calendar()
    for (const day of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']) {
      expect(cell(day)).not.toHaveAttribute('data-status')
      expect(cell(day)).toHaveAttribute('data-comparison', 'pending')
      expect(cell(day)).toHaveAccessibleName(/guideline comparison pending/)
    }
    expect(cell('2026-10-04')).toHaveAttribute('data-status', 'alcohol-free')
    expect(cell('2026-10-03')).toHaveAttribute('data-status', 'unrecorded')
    expect(document.querySelector('[data-status="unavailable"]')).toBeNull()
    expect(screen.getByText('Recorded drinking days are shown in grey until the guideline reference is available.')).toBeVisible()
    expect(within(screen.getByRole('list', { name: 'Calendar legend' })).getAllByRole('listitem')).toHaveLength(3)
    expect(await repository.list()).toHaveLength(records.length)
    expect(await checkIns.initialize()).toEqual({ alcoholFreeDates: ['2026-10-04'] })
  })

  it('selects unrecorded past dates and today without writing data, while future dates are disabled', async () => {
    const { repository, checkIns } = await seed([record('future', 19), record('saved', 5)])
    const legacy = { id: 'tracking-start' as const, kind: 'tracking-start' as const, date: '2020-01-01' }
    const db = await openCheckInDatabase(); await db.put('daily_checkins', legacy)
    const before = await repository.list()
    await calendar()
    const url = window.location.href
    for (const date of ['2026-10-03', '2026-10-18']) {
      expect(cell(date)).toBeEnabled()
      fireEvent.click(cell(date))
      expect(cell(date)).toHaveAttribute('aria-pressed', 'true')
      expect(within(detail()).getByText('No records for this day')).toBeVisible()
      expect(within(detail()).getByText("You haven't recorded any drinking information for this date.")).toBeVisible()
      expect(within(detail()).getByRole('link', { name: 'Record this day →' })).toHaveAttribute('href', '/iteration3/record?date=' + date)
      expect(screen.queryByText('Alcohol-free day')).not.toBeInTheDocument()
    }
    expect(cell('2026-10-18')).toHaveClass('history-calendar-day--today', 'history-calendar-day--selected')
    for (const date of ['2026-10-19', '2026-10-20']) {
      expect(cell(date)).toBeDisabled(); fireEvent.click(cell(date))
    }
    expect(cell('2026-10-18')).toHaveAttribute('aria-pressed', 'true')
    expect(window.location.href).toBe(url)
    expect(await repository.list()).toEqual(before)
    expect(await checkIns.initialize()).toEqual({ alcoholFreeDates: [] })
    expect(await db.get('daily_checkins', 'tracking-start')).toEqual(legacy)
    noOldHistory()
  })

  it('clears selection on month changes and renders a complete leap-year month', async () => {
    await seed([record('october', 5), record('september', 20, 1, 8)])
    await calendar(); fireEvent.click(cell('2026-10-05'))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('table', { name: 'September 2026 calendar' })).toBeVisible()
    expect(document.querySelectorAll('.history-calendar-day')).toHaveLength(30)
    expect(screen.getByText(instruction)).toBeVisible()
    fireEvent.click(cell('2026-09-20'))
    expect(screen.getByText('Saved september')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByText(instruction)).toBeVisible()
    fireEvent.click(document.querySelector('.history-month-label')!)
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2024' } })
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('table', { name: 'February 2024 calendar' })).toBeVisible()
    expect(document.querySelectorAll('.history-calendar-day')).toHaveLength(29)
    expect(screen.getByText(instruction)).toBeVisible()
    fireEvent.click(cell('2024-02-29'))
    expect(cell('2024-02-29')).toHaveAttribute('aria-pressed', 'true')
    expect(within(detail()).getByRole('link', { name: 'Record this day →' })).toHaveAttribute('href', '/iteration3/record?date=2024-02-29')
  })

  it('passes an unrecorded day to the unchanged Record flow and returns to its updated month after saving', async () => {
    const { repository, checkIns } = await seed([record('existing', 30, 1, 8)])
    await calendar(); fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    fireEvent.click(cell('2026-09-20'))
    expect(await repository.list()).toHaveLength(1)
    fireEvent.click(screen.getByRole('link', { name: 'Record this day →' }))
    expect(window.location.pathname).toBe('/iteration3/record')
    expect(window.location.search).toBe('?date=2026-09-20')
    fireEvent.click(await screen.findByRole('button', { name: 'Record Manually' }))
    expect(screen.queryByRole('button', { name: /No alcohol today/ })).not.toBeInTheDocument()
    fireEvent.change(await screen.findByLabelText('Drink type'), { target: { value: 'other' } })
    fireEvent.change(screen.getByLabelText('Drink name'), { target: { value: 'Selected-day drink' } })
    fireEvent.change(screen.getByLabelText('Custom volume (mL)'), { target: { value: '330' } })
    fireEvent.change(screen.getByLabelText('ABV (%)'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Number of servings consumed'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '18:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record Drink' }))
    await screen.findByRole('heading', { name: 'Drink recorded' })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await screen.findByRole('table', { name: 'September 2026 calendar' })
    expect(cell('2026-09-20')).toHaveAttribute('aria-pressed', 'true')
    expect(cell('2026-09-20')).toHaveAttribute('data-status', 'within')
    expect(screen.getByText('Selected-day drink')).toBeVisible()
    expect(screen.queryByText('Saved existing')).not.toBeInTheDocument()
    const saved = await repository.list()
    expect(saved).toHaveLength(2)
    expect(getRecordLocalCalendarDateKey(saved.find(item => item.drinkName === 'Selected-day drink')!)).toBe('2026-09-20')
    expect(await checkIns.initialize()).toEqual({ alcoholFreeDates: [] })
    noOldHistory()
  })

  it('cancels date-aware capture back to the selected empty day without writing', async () => {
    const { repository } = await seed()
    await calendar(); fireEvent.click(cell('2026-10-03'))
    fireEvent.click(screen.getByRole('link', { name: 'Record this day →' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel · Back to History' }))
    await screen.findByRole('table', { name: /calendar$/ })
    expect(cell('2026-10-03')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('No records for this day')).toBeVisible()
    expect(await repository.list()).toEqual([])
  })

  it('retains selection while editing and moving the last drink to a different date', async () => {
    const { repository, checkIns } = await seed([record('edit', 5, 4.001)])
    await calendar(); fireEvent.click(cell('2026-10-05'))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Saved edit' }))
    fireEvent.change(screen.getByLabelText('Drink name'), { target: { value: 'Corrected drink' } })
    fireEvent.change(screen.getByLabelText('Number of servings consumed'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('table', { name: /calendar$/ })
    expect(cell('2026-10-05')).toHaveAttribute('aria-pressed', 'true')
    expect(cell('2026-10-05')).toHaveAttribute('data-status', 'within')
    expect(document.querySelector('.history-day-total')).toHaveTextContent('1.6')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Corrected drink' }))
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-06' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('table', { name: /calendar$/ })
    expect(cell('2026-10-05')).toHaveAttribute('aria-pressed', 'true')
    expect(cell('2026-10-05')).toHaveAttribute('data-status', 'unrecorded')
    expect(screen.getByText('No records for this day')).toBeVisible()
    expect(cell('2026-10-06')).toHaveAttribute('data-status', 'within')
    expect(getRecordLocalCalendarDateKey((await repository.list())[0])).toBe('2026-10-06')
    expect(await checkIns.initialize()).toEqual({ alcoholFreeDates: [] })
    fireEvent.click(cell('2026-10-06'))
    expect(screen.getByText('Corrected drink')).toBeVisible()
  })

  it('recalculates after deletion and keeps the empty date selected without creating an alcohol-free confirmation', async () => {
    const { repository, checkIns } = await seed([record('first', 5, 3), record('second', 5, 2)], ['2026-10-04'])
    await calendar(); fireEvent.click(cell('2026-10-05'))
    for (const id of ['first', 'second']) {
      fireEvent.click(screen.getByRole('button', { name: 'Delete Saved ' + id }))
      fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /^Delete$/ }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      if (id === 'first') {
        expect(document.querySelector('.history-day-total')).toHaveTextContent('2.0')
        expect(cell('2026-10-05')).toHaveAttribute('data-status', 'within')
      }
    }
    expect(cell('2026-10-05')).toHaveAttribute('aria-pressed', 'true')
    expect(cell('2026-10-05')).toHaveAttribute('data-status', 'unrecorded')
    expect(screen.getByText('No records for this day')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Record this day →' })).toHaveAttribute('href', '/iteration3/record?date=2026-10-05')
    expect(await repository.list()).toEqual([])
    expect(await checkIns.initialize()).toEqual({ alcoholFreeDates: ['2026-10-04'] })
    noOldHistory()
  })

  it('restores the selected capture date with browser Back and removes the superseded daily route', async () => {
    await calendar(); fireEvent.click(cell('2026-10-03'))
    fireEvent.click(screen.getByRole('link', { name: 'Record this day →' }))
    await screen.findByRole('button', { name: 'Record Manually' })
    await act(async () => {
      const pop = new Promise<void>(resolve => window.addEventListener('popstate', () => resolve(), { once: true }))
      window.history.back(); await pop
    })
    await screen.findByRole('table', { name: /calendar$/ })
    expect(cell('2026-10-03')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('link', { name: /^Home$/ }))
    fireEvent.click(screen.getByRole('link', { name: /^Trends$/ }))
    await screen.findByRole('table', { name: /calendar$/ })
    expect(screen.getByText(instruction)).toBeVisible()
    window.history.pushState({}, '', '/iteration3/trends/day?date=2026-10-05')
    fireEvent(window, new PopStateEvent('popstate'))
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Daily History' })).not.toBeInTheDocument()
  })
})
