
/** Real local-record projections: no catalog fixtures or network write path. */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReferenceHistoryTrends } from '../../../../frontend/src/features/drinks/components/ReferenceHistoryTrends'
import { getCurrentLocalCalendarDateKey } from '../../../../frontend/src/features/drinks/utils/localCalendarDate'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'

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
 it('requires a 28-calendar-day span and exports only through native print',()=>{
  show([record('start',27,2),record('today',0,1)],'report')
  expect(screen.getByRole('heading',{name:'SipAware Drinking Report'})).toBeInTheDocument()
  const print=vi.spyOn(window,'print').mockImplementation(()=>{})
  fireEvent.click(screen.getByRole('button',{name:'Export PDF'}))
  expect(print).toHaveBeenCalledOnce()
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
