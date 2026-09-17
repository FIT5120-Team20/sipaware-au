
/** Real local-record projections: no catalog fixtures or network write path. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DrinkingRecordEditor } from '../../../../frontend/src/features/drinks/components/DrinkingRecordEditor'
import { DRINK_REFERENCE_CATEGORIES } from '../../../epic1/frontend/fixtures/drinkReferenceFixture'
import { createDrinkingReportPdf, type DrinkingReportPdfData } from '../../../../frontend/src/features/drinks/utils/drinkingReportPdf'
import { ReferenceHistoryTrends } from '../../../../frontend/src/features/drinks/components/ReferenceHistoryTrends'
import { getCurrentLocalCalendarDateKey } from '../../../../frontend/src/features/drinks/utils/localCalendarDate'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'

// Keep noon/afternoon fixtures in the past, with real timers for IndexedDB and UI work.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 18, 18, 0, 0))
})
afterEach(() => vi.useRealTimers())

function record(id: string, daysAgo: number, standardDrinks: number): DrinkingRecord {
 const date = new Date(); date.setDate(date.getDate() - daysAgo); date.setHours(13, 0, 0, 0)
 return { id, drinkType:'beer', drinkName:'Synthetic '+id, servingVolumeMl:1000, abvPercent:1,
  amountConsumed:standardDrinks / .789, consumedAt:date.toISOString(),
  consumedTimezoneOffsetMinutes:date.getTimezoneOffset(), createdAt:date.toISOString() }
}
function show(records: DrinkingRecord[], tab='trends', failed=false) {
 window.history.replaceState({}, '', '/trends#'+tab)
 const retry=vi.fn(), update=vi.fn(), remove=vi.fn().mockResolvedValue(undefined)
 render(<ReferenceHistoryTrends records={records} referenceCategories={[]} onUpdate={update} onDelete={remove}
  guidelineStatus={failed?'failed':'loaded'} onRetryGuidelines={retry} todayKey={getCurrentLocalCalendarDateKey()}
  guidelines={failed?null:{guidelines:[
   {id:1,guidelineType:'DAILY',thresholdStandardDrinks:4,periodDescription:'day',guidelineText:'Daily fixture',source:{id:1,organisation:'NHMRC synthetic test source',name:'Synthetic reference',url:'https://example.org/daily'}},
   {id:2,guidelineType:'WEEKLY',thresholdStandardDrinks:10,periodDescription:'week',guidelineText:'Weekly fixture',source:{id:2,organisation:'NHMRC synthetic test source',name:'Synthetic reference',url:'https://example.org/weekly'}}
  ]}} />)
 return {retry,update,remove}
}
describe('Reference History, Trends and Report',()=>{
 it('counts raw threshold crossings, excludes future data and changes period',()=>{
  show([record('below',0,3.999),record('above',1,4.001),record('outside',28,12),record('future',-1,100)])
  const daily=screen.getByText('Recorded days above 4 standard drinks').parentElement!
  expect(daily).toHaveTextContent('1')
  const averages=document.querySelectorAll('.trend-kpi-card')
  const period=screen.getByLabelText('Trend period')
  expect(period).toHaveValue('7d')
  expect(within(period).getAllByRole('option').map(option=>option.textContent)).toEqual(['Past 7 days','Past 4 weeks'])
  expect(averages[0]).toHaveTextContent('8.0')
  expect(averages[1]).toHaveTextContent('2')
  expect(document.querySelectorAll('.trend-bar-column')).toHaveLength(7)
  expect(screen.getByRole('heading',{name:'Daily standard drinks'})).toBeInTheDocument()
  fireEvent.change(period,{target:{value:'4w'}})
  expect(averages[0]).toHaveTextContent('2.0')
  expect(averages[1]).toHaveTextContent('0.5')
  expect(document.querySelectorAll('.trend-bar-column')).toHaveLength(4)
  fireEvent.change(screen.getByLabelText('Trend period'),{target:{value:'7d'}})
  expect(averages[0]).toHaveTextContent('8.0')
  expect(document.querySelectorAll('.trend-bar-column')).toHaveLength(7)
  expect(screen.getByText(/Not enough earlier data/)).toBeInTheDocument()
 })
 it('uses original recorded wall-clock dates after a viewer timezone change',()=>{
  const item=record('offset',0,2)
  const today=getCurrentLocalCalendarDateKey()
  item.consumedAt=new Date(today+'T00:30:00+14:00').toISOString()
  item.consumedTimezoneOffsetMinutes=-840
  show([item],'history')
  expect(screen.getByText('Synthetic offset')).toBeInTheDocument()
  expect(screen.getByText('12:30 am')).toBeInTheDocument()
 })
 it('requires a 28-calendar-day span and exports an actual local PDF',()=>{
  show([record('start',27,2),record('today',0,1)],'report')
  expect(screen.getByRole('heading',{name:'SipAware Drinking Report'})).toBeInTheDocument()
  const original=URL.createObjectURL, originalRevoke=URL.revokeObjectURL
  vi.useFakeTimers()
  const create=vi.fn().mockReturnValue('blob:local-report')
  URL.createObjectURL=create
  URL.revokeObjectURL=vi.fn()
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{})
  fireEvent.click(screen.getByRole('button',{name:'Export PDF'}))
  expect(create).toHaveBeenCalledWith(expect.objectContaining({type:'application/pdf'}))
  expect(click).toHaveBeenCalledOnce()
  vi.runAllTimers()
  URL.createObjectURL=original;URL.revokeObjectURL=originalRevoke;click.mockRestore();vi.useRealTimers()
 })
 it('keeps insufficient history explicit and offers no sample-data loading',()=>{
  show([record('start',26,2)],'report')
  expect(screen.getByText('Not enough history yet')).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Export PDF'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:/Load.*sample/})).not.toBeInTheDocument()
 })
 it('keeps totals local when guideline references fail and retries honestly',()=>{
  const {retry}=show([record('today',0,2)],'trends',true)
  expect(document.querySelectorAll('.trend-guideline')).toHaveLength(0)
  expect(screen.getByText('Reference unavailable')).toBeInTheDocument()
  expect(screen.getByText('Recorded days above unavailable standard drinks').parentElement).toHaveTextContent('Unavailable')
  fireEvent.click(screen.getByRole('button',{name:'Retry guideline comparison'}))
  expect(retry).toHaveBeenCalledOnce()
  expect(document.body.textContent).not.toContain('NaN')
 })
 it('navigates the month picker and native tab history',()=>{
  show([record('today',0,2)],'history')
  fireEvent.click(screen.getByRole('button',{name:'Previous month'}))
  expect(screen.queryByText('Synthetic today')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Next month'}))
  expect(screen.getByText('Synthetic today')).toBeInTheDocument()
  fireEvent.click(document.querySelector('.history-month-label')!)
  expect(screen.getByLabelText('Year')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Apply'}))
  fireEvent.click(screen.getByRole('button',{name:'Trends'}))
  expect(window.location.hash).toBe('#trends')
  window.history.replaceState({}, '', '/trends#report')
  fireEvent(window,new PopStateEvent('popstate'))
  expect(screen.getByRole('heading',{name:'Four-week drinking report'})).toBeInTheDocument()
 })
 it('only requests deletion after the native confirmation and keeps failure visible',async()=>{
  const {remove}=show([record('today',0,2)],'history')
  remove.mockRejectedValueOnce(new Error('Synthetic write failure'))
  fireEvent.click(screen.getByRole('button',{name:'Actions for Synthetic today'}))
  fireEvent.click(screen.getByRole('button',{name:'Delete'}))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Delete'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be deleted')
  expect(screen.getByText('Synthetic today')).toBeInTheDocument()
 })
})


// These checks exercise differences between all-history and selected-period data,
// database/manual edit policies, and the exported bytes rather than UI-only mocks.
describe('Epic4 period and correction integration', () => {
  it('shows an empty selected period even when older history exists', () => {
    show([record('old', 29, 8)])
    expect(screen.getByText('No trend data yet.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', {name:'Daily standard drinks'})).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Trend period'), {target:{value:'4w'}})
    expect(screen.getByText('No trend data yet.')).toBeInTheDocument()
    expect(screen.getByText(/There are no drinking records in this period/)).toBeInTheDocument()
  })
  it('shows honest pattern ties and does not infer a pattern from one record', () => {
    show([record('only',0,1)])
    expect(screen.getAllByText('Not enough data')).toHaveLength(2)
    cleanup()
    show([record('a',0,1),record('b',1,1),record('c',2,1)])
    expect(screen.getByText('No single most common day')).toBeInTheDocument()
  })
  it('compares complete equivalent recorded periods and preserves precise thresholds', () => {
    show([record('start',13,2),record('current',0,4)])
    expect(screen.getByText('100% higher than the previous 7 days.')).toBeInTheDocument()
  })
  it('keeps database drink fields locked while saving amount/date/time changes', async () => {
    const item = {...record('database',1,2),recordSource:'database' as const}
    const save=vi.fn().mockResolvedValue(undefined), cancel=vi.fn()
    render(<DrinkingRecordEditor presentation="reference" record={item}
      referenceCategories={DRINK_REFERENCE_CATEGORIES} onSave={save} onCancel={cancel}/>)
    for (const name of ['Drink type','Drink name','Serving size / volume','Custom volume (mL)','ABV (%)'])
      expect(screen.getByLabelText(name)).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Number of servings consumed'),{target:{value:'2'}})
    fireEvent.change(screen.getByLabelText('Time'),{target:{value:'20:15'}})
    fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
    await waitFor(()=>expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0]).toMatchObject({
      recordSource:'database',drinkName:item.drinkName,drinkType:item.drinkType,
      servingVolumeMl:item.servingVolumeMl,abvPercent:item.abvPercent,amountConsumed:2,
      id:item.id,createdAt:item.createdAt,
    })
  })
  it('blocks future corrections without calling persistence', async () => {
    const item = {...record('past',1,1),recordSource:'manual' as const}
    const save = vi.fn().mockResolvedValue(undefined)
    render(<DrinkingRecordEditor record={item} referenceCategories={DRINK_REFERENCE_CATEGORIES}
      onSave={save} onCancel={vi.fn()}/>)
    // A programmatically entered date bypasses the native picker's max.
    fireEvent.change(screen.getByLabelText('Date'), {target:{value:'2999-01-01'}})
    fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
    expect(await screen.findByText('Choose today or an earlier date.')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })
  it('allows manual drink corrections and cancel never writes', async () => {
    const item={...record('manual',0,1),recordSource:'manual' as const}
    const save=vi.fn().mockResolvedValue(undefined),cancel=vi.fn()
    render(<DrinkingRecordEditor presentation="reference" record={item}
      referenceCategories={DRINK_REFERENCE_CATEGORIES} onSave={save} onCancel={cancel}/>)
    expect(screen.getByLabelText('Drink name')).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Drink name'),{target:{value:'Corrected manual beer'}})
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}))
    expect(cancel).toHaveBeenCalledOnce();expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Save changes'}))
    await waitFor(()=>expect(save).toHaveBeenCalledOnce())
    expect(save.mock.calls[0][0].drinkName).toBe('Corrected manual beer')
    expect(item.drinkName).toBe('Synthetic manual')
  })
})

const reportFixture: DrinkingReportPdfData = {
 start:'2026-08-20',end:'2026-09-16',generated:'2026-09-16',
 recordedDays:2,total:12,avgPerWeek:3,avgDrinkingDaysPerWeek:.5,
 avgPerDrinkingDay:6,highestDay:8,daysAbove:1,weeksAbove:0,
 dailyGuideline:4,weeklyGuideline:10,
 weeks:[{label:'W1',total:4},{label:'W2',total:0},{label:'W3',total:0},{label:'W4',total:8}],
 dailyTotals:[{date:'2026-09-16',total:8},{date:'2026-08-20',total:4}],
}
describe('Epic4 actual PDF bytes',()=>{
 it('contains readable summary, guideline references, vector bars, daily history and disclaimer',()=>{
  const pdf=new TextDecoder().decode(createDrinkingReportPdf(reportFixture))
  expect(pdf.startsWith('%PDF-1.4')).toBe(true)
  for(const text of ['SipAware Drinking Report','Reporting period: 2026-08-20 to 2026-09-16',
    'Average recorded standard drinks / week','Recorded days above 4.0 standard drinks: 1',
    'Recorded weeks above 10.0 standard drinks: 0 of 4','Weekly recorded standard drinks',
    'Week 4','2026-09-16','2026-08-20','Not a medical diagnosis.','Page 2 of 2']) expect(pdf).toContain(text)
  expect(pdf).toContain('/Count 2')
  const xref=Number(pdf.match(/startxref\n(\d+)/)![1])
  expect(pdf.slice(xref,xref+4)).toBe('xref')
  expect(pdf).not.toContain('alcohol-free')
 })
 it('bounds a 28-day history to two pages and handles unavailable guidelines honestly',()=>{
  const dailyTotals=Array.from({length:28},(_,i)=>({date:'2026-08-'+String(i+1).padStart(2,'0'),total:1}))
  const pdf=new TextDecoder().decode(createDrinkingReportPdf({...reportFixture,dailyTotals,weeklyGuideline:null,weeksAbove:null}))
  expect(pdf).toContain('2026-08-28')
  expect(pdf).toContain('Guideline reference unavailable')
  expect(pdf).toContain('/Count 2')
  expect(()=>createDrinkingReportPdf({...reportFixture,total:Infinity})).toThrow()
 })
})
