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

describe('daily entry and History backfill', () => {
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

  it('keeps cancelled past days unknown and requires an explicit time before saving to the selected date', async () => {
    await beginHistory()
    fireEvent.click(within(day('2026-10-04')).getByRole('button', { name:'Add entry' }))
    fireEvent.click(within(day('2026-10-04')).getByRole('button', { name:'Cancel' }))
    expect(within(day('2026-10-04')).getByText('No data')).toBeInTheDocument()
    fireEvent.click(within(day('2026-10-04')).getByRole('button', { name:'Add entry' }))
    fireEvent.click(within(day('2026-10-04')).getByRole('button', { name:/I drank/ }))
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
    expect(within(day('2026-10-05')).getByText('No data')).toBeInTheDocument()
    const records = await new IndexedDbDrinkingRecordRepository().list()
    expect(records).toHaveLength(1); expect(getRecordLocalCalendarDateKey(records[0])).toBe('2026-10-04')
  })

  it('opens a past-month result before Done selects the correct History month and page', async () => {
    await beginHistory()
    fireEvent.click(screen.getByRole('button', { name:'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name:'Next' }))
    fireEvent.click(within(day('2026-09-20')).getByRole('button', { name:'Add entry' }))
    fireEvent.click(within(day('2026-09-20')).getByRole('button', { name:/I drank/ }))
    await fillDrink()
    fireEvent.change(screen.getByLabelText('Time'), { target:{ value:'18:30' } })
    fireEvent.click(screen.getByRole('button', { name:'Record Drink' }))
    await screen.findByRole('heading', { name:'Drink recorded' })
    expect(window.location.pathname).toBe('/iteration3/record')
    fireEvent.click(screen.getByRole('button', { name:'Done' }))
    await screen.findByRole('heading', { name:'Your drinking records' })
    expect(within(day('2026-09-20')).getByText('Backfilled test drink')).toBeInTheDocument()
    expect(screen.getByText(/Page 2 of 5/)).toBeInTheDocument()
    expect(day('2026-09-20')).toHaveFocus()
    expect(await new IndexedDbDrinkingRecordRepository().list()).toHaveLength(1)
  })

  it('returns to the correct month and page after an alcohol-free backfill, with no fake drinking records', async () => {
    await beginHistory()
    fireEvent.click(screen.getByRole('button', { name:'Previous month' }))
    fireEvent.click(screen.getByRole('button', { name:'Next' }))
    fireEvent.click(within(day('2026-09-20')).getByRole('button', { name:'Add entry' }))
    fireEvent.click(within(day('2026-09-20')).getByRole('button', { name:/No alcohol/ }))
    await waitFor(() => expect(within(day('2026-09-20')).getByText('Alcohol-free day')).toBeInTheDocument())
    expect(screen.getByText(/Page 2 of 5/)).toBeInTheDocument()
    expect(day('2026-09-20')).toHaveFocus()
    expect(await new IndexedDbDrinkingRecordRepository().list()).toEqual([])
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
