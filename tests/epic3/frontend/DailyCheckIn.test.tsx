/** Exercise the real route/repository boundary, including cancellation and failure. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../../frontend/src/App'
import { IndexedDbDrinkingRecordRepository } from '../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import { IndexedDbDailyCheckInRepository } from '../../../frontend/src/features/drinks/storage/dailyCheckInRepository'
import { openCheckInDatabase } from '../../../frontend/src/features/drinks/storage/dailyCheckInDatabase'
import { getRecordLocalCalendarDateKey } from '../../../frontend/src/features/drinks/utils/localCalendarDate'

beforeEach(() => {
  vi.useFakeTimers({ toFake:['Date'] }); vi.setSystemTime(new Date(2026,9,5,20))
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
async function beginHistory() {
  const db = await openCheckInDatabase()
  await db.put('daily_checkins', { id:'tracking-start', kind:'tracking-start', date:'2026-09-01' })
  window.history.replaceState({}, '', '/iteration3/trends#history')
  render(<App />); await screen.findByRole('heading', { name:'Your drinking records' })
}
function day(date: string) { return document.getElementById('history-day-' + date)! }
async function fillDrink() {
  const help = screen.queryByRole('button', { name:'Got it' }); if (help) fireEvent.click(help)
  fireEvent.click(await screen.findByRole('button', { name:'Record Manually' }))
  await waitFor(() => expect(screen.getByLabelText('Drink type')).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Drink type'), { target:{ value:'other' } })
  fireEvent.change(screen.getByLabelText('Drink name'), { target:{ value:'Backfilled test drink' } })
  fireEvent.change(screen.getByLabelText('Custom volume (mL)'), { target:{ value:'330' } })
  fireEvent.change(screen.getByLabelText('ABV (%)'), { target:{ value:'5' } })
  fireEvent.change(screen.getByLabelText('Number of servings consumed'), { target:{ value:'1' } })
}

describe('daily entry and saved-only History', () => {
  it('opens the minimal entry, saves a real zero status and retains it after reload', async () => {
    window.history.replaceState({}, '', '/iteration3/record')
    const view = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name:/No alcohol today/ }))
    await screen.findByText('Alcohol-free day')
    expect(window.location.pathname).toBe('/iteration3/trends')
    expect(window.location.hash).toBe('#history')
    expect(within(day('2026-10-05')).getByText('0.0')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name:/View my history/ })).not.toBeInTheDocument()
    expect(await new IndexedDbDrinkingRecordRepository().list()).toEqual([])
    view.unmount(); render(<App />)
    await screen.findByText('Alcohol-free day')
    fireEvent.click(screen.getByRole('button', { name:'Trends', exact:true }))
    expect(document.querySelector('.trend-kpi-card')).toHaveTextContent('0.0')
    expect(screen.queryByText('No trend data yet.')).not.toBeInTheDocument()
  })

  it('keeps date-aware Record saving and cancellation without offering History backfill', async () => {
    await beginHistory()
    expect(document.querySelectorAll('.history-day')).toHaveLength(0)
    expect(document.querySelectorAll('.history-calendar-day')).toHaveLength(31)
    expect(document.querySelectorAll('.history-calendar-day[href]')).toHaveLength(0)
    expect(screen.queryByRole('button', { name:'Add a past check-in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name:'Add entry' })).not.toBeInTheDocument()
    window.history.pushState({}, '', '/iteration3/record?date=2026-10-04')
    fireEvent(window, new PopStateEvent('popstate'))
    await screen.findByRole('button', { name:'Back to daily check-in' })
    fireEvent.click(screen.getByRole('button', { name:'Back to daily check-in' }))
    expect(await screen.findByRole('button', { name:/No alcohol today/ })).toBeVisible()
    expect(await new IndexedDbDrinkingRecordRepository().list()).toEqual([])
    window.history.pushState({}, '', '/iteration3/record?date=2026-10-04')
    fireEvent(window, new PopStateEvent('popstate'))
    await fillDrink()
    expect(screen.getByLabelText('Date')).toHaveTextContent('4 October 2026')
    expect(screen.getByLabelText('Time')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name:'Record Drink' }))
    expect(await screen.findByText(/Enter the time/)).toBeInTheDocument()
    expect(await new IndexedDbDrinkingRecordRepository().list()).toEqual([])
    fireEvent.change(screen.getByLabelText('Time'), { target:{ value:'18:30' } })
    fireEvent.click(screen.getByRole('button', { name:'Record Drink' }))
    await screen.findByRole('heading', { name:'Drink recorded' })
    fireEvent.click(screen.getByRole('button', { name:'Done' }))
    await screen.findByRole('heading', { name:'Your drinking records' })
    expect(within(day('2026-10-04')).getByText('Backfilled test drink')).toBeInTheDocument()
    expect(within(day('2026-10-04')).getByText('Saved')).toBeInTheDocument()
    expect(day('2026-10-05')).toBeNull()
    expect(document.querySelectorAll('.history-day')).toHaveLength(1)
    const records = await new IndexedDbDrinkingRecordRepository().list()
    expect(records).toHaveLength(1); expect(getRecordLocalCalendarDateKey(records[0])).toBe('2026-10-04')
  })

  it('opens a past-month result before Done selects its actual saved History date', async () => {
    const repo = new IndexedDbDrinkingRecordRepository()
    for (let date = 21; date <= 30; date++) {
      const time = new Date(2026,8,date,18)
      await repo.add({ id:'seed-'+date, drinkType:'beer', drinkName:'Existing drink '+date, servingVolumeMl:330, abvPercent:5, amountConsumed:1,
        consumedAt:time.toISOString(), consumedTimezoneOffsetMinutes:time.getTimezoneOffset(), createdAt:time.toISOString() })
    }
    window.history.replaceState({}, '', '/iteration3/record?date=2026-09-20')
    render(<App />)
    await fillDrink()
    fireEvent.change(screen.getByLabelText('Time'), { target:{ value:'18:30' } })
    fireEvent.click(screen.getByRole('button', { name:'Record Drink' }))
    await screen.findByRole('heading', { name:'Drink recorded' })
    expect(window.location.pathname).toBe('/iteration3/record')
    fireEvent.click(screen.getByRole('button', { name:'Done' }))
    await screen.findByRole('heading', { name:'Your drinking records' })
    expect(within(day('2026-09-20')).getByText('Backfilled test drink')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name:'History pages' })).not.toBeInTheDocument()
    expect(document.querySelector('.history-calendar-day[data-date="2026-09-20"]')).toHaveAttribute('aria-pressed', 'true')
    expect(await repo.list()).toHaveLength(11)
  })

  it('preserves saved past confirmations while legacy metadata cannot create missing-day entries', async () => {
    await new IndexedDbDailyCheckInRepository().confirmAlcoholFree('2026-09-20')
    await beginHistory()
    expect(screen.getByText('Select a date on the calendar to view your records.')).toBeVisible()
    expect(document.querySelectorAll('.history-day')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name:'Previous month' }))
    fireEvent.click(document.querySelector('button.history-calendar-day[data-date="2026-09-20"]')!)
    expect(within(day('2026-09-20')).getByText('Alcohol-free day')).toBeInTheDocument()
    expect(within(day('2026-09-20')).getByText('0.0')).toBeInTheDocument()
    expect(document.querySelectorAll('.history-day')).toHaveLength(1)
    expect(day('2026-09-19')).toBeNull()
    expect(window.location.pathname).toBe('/iteration3/trends')
    expect(screen.queryByRole('button', { name:/Add entry|Add drink|Add a past check-in/ })).not.toBeInTheDocument()
    expect(await new IndexedDbDrinkingRecordRepository().list()).toEqual([])
    expect((await new IndexedDbDailyCheckInRepository().initialize()).alcoholFreeDates).toEqual(['2026-09-20'])
  })

  it('does not navigate or create a zero day on persistence failure', async () => {
    vi.spyOn(IndexedDbDailyCheckInRepository.prototype,'confirmAlcoholFree').mockRejectedValue(new Error('Denied'))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name:/No alcohol today/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
    expect(window.location.pathname).toBe('/record')
    expect((await new IndexedDbDailyCheckInRepository().initialize()).alcoholFreeDates).toEqual([])
  })
})
