/**
 * REUSE: HistoryTrendsPage.tsx / index.css at f5711b15 (rendering and controls).
 * ADAPT: IndexedDB snapshots supply all personal data; original local calendar
 * offsets and full-precision calculation are preserved. Reference thresholds
 * use the same validated API across History, Trends and Report.
 */
import { updateAwardsForTrendsVisit } from '../../awards/awardFeedbackEvents'
import { downloadDrinkingReportPdf } from '../utils/drinkingReportPdf'
import { revealContent } from '../../../app/revealContent'
import { applicationHref } from '../../../app/entryPaths'
import { captureNavigationScroll, prepareNavigationScroll, requestNavigationScroll, type NavigationScrollPosition } from '../../../app/navigationScroll'
import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateStandardDrinks } from '../calculations/standardDrinks'
import { getRecordLocalCalendarDateKey, getRecordedLocalWallClockDate, differenceInLocalCalendarDays, type LocalCalendarDateKey } from '../utils/localCalendarDate'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { DrinkReferenceCategory } from '../types/drinkReference'
import type { AlcoholGuidelinesResponseDto, GuidelineLoadStatus } from '../types/alcoholGuideline'
import { DrinkingRecordEditor } from './DrinkingRecordEditor'
import { isCalendarDate } from '../types/dailyCheckIn'
import { groupHistoryRecords, type HistoryRecord as ConsumptionRecord } from '../utils/historyCalendar'
import { HistoryCalendar } from './HistoryCalendar'
import { HistoryDayDetails } from './HistoryDayDetails'
import { ReferenceBackBar } from './ReferenceBackBar'
import { TrendsOverview } from './TrendsOverview'
import '../referenceHistory.css'

type HistoryTrendsTab = 'overview' | 'history'

function readHistoryTrendsTab(): HistoryTrendsTab {
  // Keep old #trends/#report links usable, and retain explicit History deep links.
  return window.location.hash === '#history' ? 'history' : 'overview'
}
type Props = {
 records: ConsumptionRecord[]
 daily: number | null
 weekly: number | null
 onDeleteRecord: (id: string) => Promise<void>
}
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}


function formatMonthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month]} ${year}`
}

function MonthChevron({ direction }: { direction: 'previous' | 'next' | 'down' }) {
  const paths = { previous: 'm15 6-6 6 6 6', next: 'm9 6 6 6-6 6', down: 'm6 9 6 6 6-6' }
  return <svg className="history-month-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[direction]} />
  </svg>
}


function getDailyTotals(records: ConsumptionRecord[]) {
  const totals = new Map<string, number>()
  records.forEach((record) => {
    totals.set(record.date, (totals.get(record.date) ?? 0) + record.standardDrinks)
  })
  return Array.from(totals.entries())
    .map(([date, total]) => ({ date, total: (total) }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

function getRecordsInRange(records: ConsumptionRecord[], start: Date, end: Date) {
  const startValue = formatDateOnly(start)
  const endValue = formatDateOnly(end)
  return records.filter((record) => record.date >= startValue && record.date <= endValue)
}


function buildFourWeekBuckets(records: ConsumptionRecord[], end: Date) {
  const reportStart = addDays(end, -27)
  const values = Array.from({ length: 4 }, (_, index) => {
    const start = addDays(reportStart, index * 7)
    const weekEnd = addDays(start, 6)
    const weekRecords = getRecordsInRange(records, start, weekEnd)
    return {
      label: `W${index + 1}`,
      total: (weekRecords.reduce((sum, record) => sum + record.standardDrinks, 0)),
    }
  })
  return { start: reportStart, end, values }
}

type CheckInHistoryProps = {
  initialDateKey?: string
  savedDay?: boolean
  alcoholFreeDates?: string[]
  onRecordDate?: (date: string) => void
}

type HistorySelection = { year: number; month: number; date: string | null }

function consumeHistoryDetailsScroll(date: string) {
  if (window.history.state?.revealHistoryDetails !== date) return
  const state = { ...window.history.state }
  delete state.revealHistoryDetails
  window.history.replaceState(state, '')
}

function initialHistorySelection(records: ConsumptionRecord[], today: string, alcoholFreeDates: string[], initialDateKey?: string, initialRecordId?: string): HistorySelection {
  const recordDate = records.find(record => record.id === initialRecordId)?.date
  const hint = isCalendarDate(initialDateKey) && initialDateKey <= today ? initialDateKey
    : isCalendarDate(recordDate) && recordDate <= today ? recordDate : null
  const initialMonth = parseDateOnly(hint ?? today)
  const date = hint ?? (records.some(record => record.date === today) || alcoholFreeDates.includes(today) ? today : null)
  return { year: initialMonth.getFullYear(), month: initialMonth.getMonth(), date }
}

type HistoryTabProps = Props & CheckInHistoryProps & {
  todayKey: string
  selection: HistorySelection
  onSelectionChange: (selection: HistorySelection) => void
  onEditRecord: (record: ConsumptionRecord) => void
}

function HistoryTab({ records, todayKey, initialDateKey, savedDay, alcoholFreeDates = [], daily, selection, onSelectionChange, onRecordDate, onDeleteRecord, onEditRecord }: HistoryTabProps) {
  const { year: viewYear, month: viewMonth, date: selectedDate } = selection
  const historySectionRef = useRef<HTMLElement>(null)
  const pendingDetailsScroll = useRef<string | null>(
    window.history.state?.revealHistoryDetails === selectedDate ? selectedDate : null,
  )
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [draftYear, setDraftYear] = useState(viewYear)
  const [draftMonth, setDraftMonth] = useState(viewMonth)
  useEffect(() => {
    const date = selection.date
    if (!date || pendingDetailsScroll.current !== date) return
    // Calendar clicks and View records share this scroll after details render.
    const frame = window.requestAnimationFrame(() => {
      if (pendingDetailsScroll.current !== date) return
      pendingDetailsScroll.current = null
      consumeHistoryDetailsScroll(date)
      const details = historySectionRef.current?.querySelector<HTMLElement>('#history-day-details')
      if (details) revealContent(details)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      consumeHistoryDetailsScroll(date)
    }
  }, [selection])
  const groupedRecords = useMemo(() => {
    const prefix = viewYear + '-' + String(viewMonth + 1).padStart(2, '0') + '-'
    return groupHistoryRecords(records.filter(record => record.date.startsWith(prefix) && record.date <= todayKey),
      alcoholFreeDates.filter(date => date.startsWith(prefix) && date <= todayKey))
  }, [records, alcoholFreeDates, todayKey, viewYear, viewMonth])
  const years = useMemo(() => {
    const current = new Date().getFullYear()
    const recordYears = [...records.map(record => record.date), ...alcoholFreeDates].filter(isCalendarDate).map(date => parseDateOnly(date).getFullYear())
    const min = Math.min(current - 5, viewYear, ...recordYears)
    const max = Math.max(current, viewYear, ...recordYears)
    return Array.from({ length: max - min + 1 }, (_, index) => max - index)
  }, [records, alcoholFreeDates, viewYear])
  const moveMonth = (offset: number) => {
    pendingDetailsScroll.current = null
    const next = new Date(viewYear, viewMonth + offset, 1)
    onSelectionChange({ year: next.getFullYear(), month: next.getMonth(), date: null })
    setShowMonthPicker(false)
  }
  const applyMonth = () => {
    pendingDetailsScroll.current = null
    onSelectionChange({ year: draftYear, month: draftMonth, date: null })
    setShowMonthPicker(false)
  }
  return <section ref={historySectionRef} className="ht-section history-section" aria-labelledby="history-heading">
    <div className="ht-section-heading-row">
      <div>
        <h2 id="history-heading" tabIndex={-1} className="ht-section-title">Your drinking records</h2>
        <p className="history-section-subtitle">Tap a date to view or record your drinking information.</p>
      </div>
    </div>
    <div className="history-calendar-card">
      <div className="history-month-nav" aria-label="History month navigation">
        <button type="button" className="history-month-arrow" onClick={() => moveMonth(-1)} aria-label="Previous month"><MonthChevron direction="previous" /></button>
        <button type="button" className="history-month-label" onClick={() => { setDraftYear(viewYear); setDraftMonth(viewMonth); setShowMonthPicker(value => !value) }} aria-expanded={showMonthPicker}>
          {formatMonthLabel(viewYear, viewMonth)}<MonthChevron direction="down" />
        </button>
        <button type="button" className="history-month-arrow" onClick={() => moveMonth(1)} aria-label="Next month"><MonthChevron direction="next" /></button>
      </div>
      {showMonthPicker && <div className="history-month-picker">
        <label><span>Year</span><select aria-label="Year" value={draftYear} onChange={event => setDraftYear(Number(event.target.value))}>
          {years.map(year => <option key={year} value={year}>{year}</option>)}
        </select></label>
        <label><span>Month</span><select aria-label="Month" value={draftMonth} onChange={event => setDraftMonth(Number(event.target.value))}>
          {MONTH_NAMES.map((month, index) => <option key={month} value={index}>{month}</option>)}
        </select></label>
        <button className="ht-primary-button" onClick={applyMonth}>Apply</button>
      </div>}
      <HistoryCalendar year={viewYear} month={viewMonth} today={todayKey} groups={groupedRecords} dailyGuideline={daily}
        selectedDate={selectedDate} onSelectDate={date => {
          pendingDetailsScroll.current = date
          onSelectionChange({ ...selection, date })
        }} />
    </div>
    <HistoryDayDetails date={selectedDate} group={groupedRecords.find(([date]) => date === selectedDate)}
      savedDate={savedDay ? initialDateKey : undefined} onRecordDate={onRecordDate}
      onDeleteRecord={onDeleteRecord} onEditRecord={onEditRecord} />
  </section>
}


function ReportDownloadSection({ records, daily, weekly, todayKey }: Pick<Props, 'records' | 'daily' | 'weekly'> & { todayKey: string }) {
  const today = useMemo(() => parseDateOnly(todayKey), [todayKey])
  const earliestRecord = records.length > 0
    ? [...records].sort((a, b) => a.date.localeCompare(b.date))[0]
    : null
  const historySpanDays = earliestRecord
    ? differenceInLocalCalendarDays(formatDateOnly(today) as LocalCalendarDateKey, earliestRecord.date as LocalCalendarDateKey) + 1
    : 0
  const canGenerate = historySpanDays >= 28

  const report = useMemo(() => {
    const { start, end, values } = buildFourWeekBuckets(records, today)
    const reportRecords = getRecordsInRange(records, start, end)
    const dailyTotals = getDailyTotals(reportRecords)
    const total = (reportRecords.reduce((sum, record) => sum + record.standardDrinks, 0))
    const recordedDays = dailyTotals.length
    const avgPerWeek = (total / 4)
    const avgDrinkingDaysPerWeek = Math.round((recordedDays / 4) * 10) / 10
    const avgPerDrinkingDay = recordedDays > 0 ? (total / recordedDays) : 0
    const highestDay = dailyTotals.length > 0 ? Math.max(...dailyTotals.map((day) => day.total)) : 0
    const daysAboveFour = daily === null ? null : dailyTotals.filter((day) => day.total > daily).length
    const weeksAboveTen = weekly === null ? null : values.filter((week) => week.total > weekly).length

    return {
      start,
      end,
      values,
      dailyTotals,
      total,
      recordedDays,
      avgPerWeek,
      avgDrinkingDaysPerWeek,
      avgPerDrinkingDay,
      highestDay,
      daysAboveFour,
      weeksAboveTen,
    }
  }, [records, daily, weekly, today])

  const [exportError, setExportError] = useState<string | null>(null)
  const exportPdf = () => {
    setExportError(null)
    try {
      downloadDrinkingReportPdf({
        start: formatDateOnly(report.start), end: formatDateOnly(report.end),
        generated: formatDateOnly(today), recordedDays: report.recordedDays,
        total: report.total, avgPerWeek: report.avgPerWeek,
        avgDrinkingDaysPerWeek: report.avgDrinkingDaysPerWeek,
        avgPerDrinkingDay: report.avgPerDrinkingDay, highestDay: report.highestDay,
        daysAbove: report.daysAboveFour, weeksAbove: report.weeksAboveTen,
        dailyGuideline: daily, weeklyGuideline: weekly,
        weeks: report.values, dailyTotals: report.dailyTotals,
      })
    } catch {
      setExportError('The PDF could not be created. Your records are unchanged. Please try again.')
    }
  }

  return (
    <section className="overview-card overview-report" aria-labelledby="report-heading">
      <h2 id="report-heading" className="reference-sr-only">Download Drinking Report</h2>
      <button type="button" className="overview-report-action" disabled={!canGenerate} onClick={exportPdf}>
        Download drinking report <span aria-hidden="true">→</span>
      </button>
      <p>Four-week recorded summary for your GP.</p>
      {!canGenerate && <>
        <p>Available after four weeks of recorded drinking history · {Math.min(historySpanDays, 28)} of 28 days.</p>
        <div className="report-progress" aria-label={`${Math.min(historySpanDays, 28)} of 28 days of history available`}>
          <div style={{ width: `${Math.min(100, (historySpanDays / 28) * 100)}%` }} />
        </div>
      </>}
      {exportError && <p role="alert">{exportError}</p>}
      <details className="overview-explanation"><summary>About your report</summary>
        <p>This report is based on alcohol consumption recorded by the user in SipAware. It may not represent all alcohol consumed and is not a medical diagnosis.</p>
      </details>
    </section>
  )
}

/** Read-only projection; source snapshots are never replaced with chart data. */
function projectHistoryRecord(record: DrinkingRecord): ConsumptionRecord {
 const wall = getRecordedLocalWallClockDate(record)
 return { id: record.id, drinkName: record.drinkName, date: getRecordLocalCalendarDateKey(record),
  time: String(wall.getUTCHours()).padStart(2, '0') + ':' + String(wall.getUTCMinutes()).padStart(2, '0'),
  standardDrinks: calculateStandardDrinks(record) }
}
export function ReferenceHistoryTrends({ records, initialRecordId, referenceCategories, onUpdate, onDelete, guidelines, guidelineStatus, onRetryGuidelines, todayKey, ...checkInHistory }: CheckInHistoryProps & {
 records: DrinkingRecord[]; referenceCategories: DrinkReferenceCategory[]
 onUpdate: (record: DrinkingRecord) => Promise<void>; onDelete: (id: string) => Promise<void>
 initialRecordId?: string
 guidelines: AlcoholGuidelinesResponseDto | null; guidelineStatus: GuidelineLoadStatus; onRetryGuidelines: () => void
 todayKey: string
}) {
 const [activeTab, setActiveTab] = useState<HistoryTrendsTab>(readHistoryTrendsTab)
 const selectTab = (tab: HistoryTrendsTab) => {
  if (activeTab === tab) return
  prepareNavigationScroll()
  window.history.pushState({ ...window.history.state }, '', applicationHref('/trends#' + tab))
  updateAwardsForTrendsVisit()
  window.dispatchEvent(new PopStateEvent('popstate'))
  requestNavigationScroll({ kind: 'top' })
 }
 const [notice, setNotice] = useState<string | null>(null)
 const [editingId, setEditingId] = useState<string | null>(null)
 const historyViewRef = useRef<HTMLElement>(null)
 const historyScroll = useRef<NavigationScrollPosition | null>(null)
 const [returnFocus, setReturnFocus] = useState<{ id: string; action: 'edit' | 'delete' } | null>(null)
 // Editors/dialogs remove their controls. Resume keyboard use at the surviving
 // record action, or the selected day when the record was moved or deleted.
 useEffect(() => {
  if (!returnFocus || editingId) return
  const frame = window.requestAnimationFrame(() => {
   const row = document.getElementById('history-record-' + returnFocus.id)
   const target = row?.querySelector<HTMLElement>('button') ?? document.getElementById('history-day-details')
   if (target && !target.hidden) {
    // Deleting/moving the last record can make the empty panel taller.
    // Reveal its replacement action rather than leaving it under navigation.
    if (!row) revealContent(target)
    else target.focus({ preventScroll: true })
   }
  })
  return () => window.cancelAnimationFrame(frame)
 }, [returnFocus, editingId])
 const openRecordEditor = (id: string) => {
  historyScroll.current = captureNavigationScroll(historyViewRef.current)
  prepareNavigationScroll()
  setEditingId(id)
  requestNavigationScroll({ kind: 'top' })
 }
 const closeRecordEditor = () => {
  prepareNavigationScroll()
  setReturnFocus(editingId ? { id: editingId, action: 'edit' } : null)
  setEditingId(null)
  requestNavigationScroll(historyScroll.current
   ? { kind: 'restore', position: historyScroll.current } : { kind: 'preserve' })
 }
 const views = useMemo(() => records.map(projectHistoryRecord), [records])
 const [historySelection, setHistorySelection] = useState(() => initialHistorySelection(views, todayKey, checkInHistory.alcoholFreeDates ?? [], checkInHistory.initialDateKey, initialRecordId))
 useEffect(() => {
  const restore = () => { setActiveTab(readHistoryTrendsTab()); setEditingId(null) }
  window.addEventListener('hashchange', restore); window.addEventListener('popstate', restore)
  return () => { window.removeEventListener('hashchange', restore); window.removeEventListener('popstate', restore) }
 }, [])
 const eligible = useMemo(() => views.filter(record => record.date <= todayKey), [views, todayKey])
 const editingRecord = records.find(record => record.id === editingId)
 const daily = guidelineStatus === 'loaded' ? guidelines?.guidelines.find(g => g.guidelineType === 'DAILY')?.thresholdStandardDrinks ?? null : null
 const weekly = guidelineStatus === 'loaded' ? guidelines?.guidelines.find(g => g.guidelineType === 'WEEKLY')?.thresholdStandardDrinks ?? null : null
 const source = guidelines?.guidelines.find(g => g.guidelineType === 'DAILY')?.source
 if (editingRecord) return <section ref={historyViewRef} className="reference-history-edit reference-edit-page">
  <ReferenceBackBar label="Back to History" href={applicationHref('/trends#history')} onClick={closeRecordEditor} />
  <h1>Edit Record</h1><p>Update this drinking record.</p>
  <DrinkingRecordEditor presentation="reference" record={editingRecord} referenceCategories={referenceCategories}
   onSave={async updated => { await onUpdate(updated); setNotice('The drinking record for ' + updated.drinkName + ' was updated.'); closeRecordEditor() }} onCancel={closeRecordEditor} />
 </section>
 return <section ref={historyViewRef} className="history-trends-page" aria-label="Trends">
  <div className="history-trends-inner">
   {notice && <p className="reference-sr-only" role="status">{notice}</p>}
   <header className="history-trends-header reference-page-heading"><h1>Trends</h1></header>
   <nav className="history-trends-tabs" role="tablist" aria-label="Trends sections">
    {(['overview', 'history'] as const).map(tab => <button key={tab} id={'trends-' + tab + '-tab'} type="button" role="tab"
     className={activeTab === tab ? 'active' : ''} aria-selected={activeTab === tab} aria-controls={'trends-' + tab + '-panel'}
     tabIndex={activeTab === tab ? 0 : -1} onClick={() => selectTab(tab)}
     onKeyDown={event => {
      const next = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'history'
       : event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? (tab === 'overview' ? 'history' : 'overview') : null
      if (!next) return
      event.preventDefault()
      selectTab(next)
      document.getElementById('trends-' + next + '-tab')?.focus({ preventScroll: true })
     }}>
     {tab === 'overview' ? 'Overview' : 'History'}</button>)}
   </nav>
   <div id="trends-overview-panel" role="tabpanel" aria-labelledby="trends-overview-tab" hidden={activeTab !== 'overview'}>
    <TrendsOverview records={records} historyRecords={views} alcoholFreeDates={checkInHistory.alcoholFreeDates ?? []}
     today={todayKey as LocalCalendarDateKey} daily={daily} weekly={weekly} guidelineStatus={guidelineStatus}
     guidelineSource={source} onRetryGuidelines={onRetryGuidelines}>
     <ReportDownloadSection records={eligible} daily={daily} weekly={weekly} todayKey={todayKey} />
    </TrendsOverview>
   </div>
   <div id="trends-history-panel" role="tabpanel" aria-labelledby="trends-history-tab" hidden={activeTab !== 'history'}>
    {activeTab === 'history' && <HistoryTab {...checkInHistory} todayKey={todayKey} records={views}
     selection={historySelection} onSelectionChange={setHistorySelection} daily={daily} weekly={weekly}
     onDeleteRecord={async id => { await onDelete(id); setReturnFocus({ id, action: 'delete' }) }} onEditRecord={record => openRecordEditor(record.id)} />}
   </div>
  </div>
 </section>
}
