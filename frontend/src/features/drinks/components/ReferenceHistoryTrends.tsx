/**
 * REUSE: HistoryTrendsPage.tsx / index.css at f5711b15 (rendering and controls).
 * ADAPT: IndexedDB snapshots supply all personal data; original local calendar
 * offsets and full-precision calculation are preserved. Reference thresholds
 * use the same validated API across History, Trends and Report.
 */
import { updateAwardsAfterCheckIn } from '../../awards/awardFeedbackEvents'
import { downloadDrinkingReportPdf } from '../utils/drinkingReportPdf'
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
import '../referenceHistory.css'

type HistoryTrendsTab = 'history' | 'trends'
type TrendPeriod = '7d' | '4w'
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

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
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

function formatTime(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return time
  const [hour, minute] = time.split(':').map(Number)
  const date = new Date(2000, 0, 1, hour, minute)
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
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

function getPeriodLabel(period: TrendPeriod) {
  return period === '7d' ? 'Past 7 days' : 'Past 4 weeks'
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

function comparisonCopy(change: number | null, period: TrendPeriod) {
  const previousLabel = period === '7d' ? 'previous 7 days' : 'previous 4 weeks'
  if (change === null) return `Not enough earlier data to compare with the ${previousLabel}.`
  if (Math.abs(change) < 5) return `About the same as the ${previousLabel}.`
  const rounded = Math.round(Math.abs(change))
  return change < 0
    ? `${rounded}% lower than the ${previousLabel}.`
    : `${rounded}% higher than the ${previousLabel}.`
}

// Pattern summaries use recorded local dates/times only. At least two
// observations are needed; ties are shown rather than choosing by input order.
function mostCommonDay(records: ConsumptionRecord[]) {
  const dates = [...new Set(records.map(record => record.date))]
  if (dates.length < 2) return 'Not enough data'
  const totals = new Map<number, number>()
  dates.forEach(date => {
    const day = parseDateOnly(date).getDay()
    totals.set(day, (totals.get(day) ?? 0) + 1)
  })
  const highest = Math.max(...totals.values())
  const winners = [...totals].filter(([, count]) => count === highest).map(([day]) => day).sort()
  if (winners.length > 2) return 'No single most common day'
  return winners.map(day => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]).join(' / ')
}

function mostCommonTime(records: ConsumptionRecord[]) {
  const times = records.filter(record => /^\d{2}:\d{2}$/.test(record.time))
  if (times.length < 2) return 'Not enough data'
  const buckets = new Map<number, number>()
  times.forEach(record => {
    const [hour, minute] = record.time.split(':').map(Number)
    const bucket = (Math.round((hour * 60 + minute) / 30) * 30) % 1440
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
  })
  const highest = Math.max(...buckets.values())
  const winners = [...buckets].filter(([, count]) => count === highest).map(([time]) => time).sort((a, b) => a - b)
  if (winners.length > 2) return 'No single most common time'
  return winners.map(time => 'Around ' + formatTime(String(Math.floor(time / 60)).padStart(2, '0') + ':' + String(time % 60).padStart(2, '0'))).join(' / ')
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
      if (!window.matchMedia('(max-width: 767px)').matches) return
      const section = historySectionRef.current
      const details = section?.querySelector<HTMLElement>('#history-day-details')
      if (!details || details.hidden) return

      const viewportTop = window.visualViewport?.offsetTop ?? 0
      const viewportBottom = viewportTop + (window.visualViewport?.height ?? window.innerHeight)
      const tabs = section?.closest('.history-trends-inner')?.querySelector<HTMLElement>('.history-trends-tabs')
      const tabStyle = tabs ? window.getComputedStyle(tabs) : null
      const stickyInset = tabs && (tabStyle?.position === 'sticky' || tabStyle?.position === 'fixed')
        ? tabs.getBoundingClientRect().height + Math.max(0, parseFloat(tabStyle.top) || 0) : 0
      const navigation = section?.closest('.reference-app')?.querySelector<HTMLElement>('.reference-navigation')
      const navigationRect = navigation?.getBoundingClientRect()
      const visibleTop = viewportTop + stickyInset + 12
      const visibleBottom = Math.min(viewportBottom,
        navigationRect && navigationRect.bottom > viewportTop ? navigationRect.top : viewportBottom) - 12
      if (visibleBottom <= visibleTop) return

      const bounds = details.getBoundingClientRect()
      // Keep the current position when the heading and a useful portion are visible.
      const minimumVisibleHeight = Math.min(bounds.height, 160, (visibleBottom - visibleTop) / 2)
      if (bounds.top >= visibleTop && bounds.top + minimumVisibleHeight <= visibleBottom) return
      // Reveal the details just above the bottom navigation, with the smallest movement.
      const scrollDelta = bounds.top < visibleTop ? bounds.top - visibleTop
        : bounds.top + minimumVisibleHeight - visibleBottom
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({
        top: Math.max(0, window.scrollY + scrollDelta),
        behavior: !reduceMotion && 'scrollBehavior' in document.documentElement.style ? 'smooth' : 'instant',
      })
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

function TrendBars({
  values,
  guideline,
  valueSuffix = '',
}: {
  values: { label: string; total: number }[]
  guideline: number | null
  valueSuffix?: string
}) {
  const maxValue = Math.max(guideline ?? 0, ...values.map((item) => item.total), 1) * 1.18
  const guidelineBottom = `${Math.min(96, ((guideline ?? 0) / maxValue) * 100)}%`

  return (
    <div className="trend-chart" aria-label="Alcohol consumption bar chart">
      {guideline !== null && <div className="trend-guideline" style={{ bottom: guidelineBottom }}>
        <span>{guideline} standard drinks guideline</span>
      </div>}
      <div className="trend-bars">
        {values.map((item) => {
          const barHeight = Math.max(item.total > 0 ? 7 : 0, (item.total / maxValue) * 100)
          return (
            <div className="trend-bar-column" key={item.label} aria-label={item.label + ': ' + item.total.toFixed(1) + ' recorded standard drinks'}>
              <div className="trend-bar-track">
                {item.total > 0 && (
                  <div className="trend-bar-value" style={{ bottom: `calc(${barHeight}% + 7px)` }}>
                    {`${item.total.toFixed(1)}${valueSuffix}`}
                  </div>
                )}
                <div className="trend-bar-fill" style={{ height: `${barHeight}%` }} />
              </div>
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrendsTab({ records, daily, weekly, alcoholFreeDates = [] }: Pick<Props, 'records' | 'daily' | 'weekly'> & { alcoholFreeDates?: string[] }) {
  const [period, setPeriod] = useState<TrendPeriod>('7d')
  const today = useMemo(() => startOfToday(), [])

  const data = useMemo(() => {
    const days = period === '7d' ? 7 : 28
    const start = addDays(today, -(days - 1))
    const previousEnd = addDays(start, -1)
    const previousStart = addDays(previousEnd, -(days - 1))
    const current = getRecordsInRange(records, start, today)
    const previous = getRecordsInRange(records, previousStart, previousEnd)
    const currentTotal = (current.reduce((sum, record) => sum + record.standardDrinks, 0))
    const previousTotal = (previous.reduce((sum, record) => sum + record.standardDrinks, 0))
    const currentDays = new Set(current.map((record) => record.date)).size
    const dailyTotals = getDailyTotals(current)

    let chartValues: { label: string; total: number }[]
    let guideline: number | null
    if (period === '7d') {
      chartValues = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(start, index)
        const dateValue = formatDateOnly(date)
        const total = current
          .filter((record) => record.date === dateValue)
          .reduce((sum, record) => sum + record.standardDrinks, 0)
        return {
          label: date.toLocaleDateString('en-AU', { weekday: 'short' }).slice(0, 3),
          total: (total),
        }
      })
      guideline = daily
    } else {
      chartValues = Array.from({ length: 4 }, (_, index) => {
        const weekStart = addDays(start, index * 7)
        const weekEnd = addDays(weekStart, 6)
        const weekRecords = getRecordsInRange(current, weekStart, weekEnd)
        return {
          label: `W${index + 1}`,
          total: (weekRecords.reduce((sum, record) => sum + record.standardDrinks, 0)),
        }
      })
      guideline = weekly
    }

    return {
      current,
      currentTotal,
      currentDays,
      currentAvgStandardDrinks: period === '4w' ? (currentTotal / 4) : currentTotal,
      currentAvgDrinkingDays: period === '4w' ? Math.round((currentDays / 4) * 10) / 10 : currentDays,
      comparison: comparisonCopy(records.some(record => record.date <= formatDateOnly(previousStart)) ? percentChange(currentTotal, previousTotal) : null, period),
      chartValues,
      guideline,
      mostCommonDay: mostCommonDay(current),
      mostCommonTime: mostCommonTime(current),
      highestDay: dailyTotals.length > 0 ? Math.max(...dailyTotals.map((day) => day.total)) : 0,
      daysAboveFour: daily === null ? null : dailyTotals.filter((day) => day.total > daily).length,
    }
  }, [period, records, daily, weekly, today])

  return (
    <section className="ht-section" aria-labelledby="trends-heading">
      <div className="ht-section-heading-row trend-heading-row">
        <div>
          <h2 id="trends-heading" className="ht-section-title">Your drinking dashboard</h2>
        </div>
        <label className="trend-period-select">
          <span className="sr-only">Trend period</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as TrendPeriod)}>
            <option value="7d">Past 7 days</option>
            <option value="4w">Past 4 weeks</option>
          </select>
        </label>
      </div>

      {/* A confirmed zero day is usable data without becoming a fake drink. */}
      {data.current.length === 0 && !alcoholFreeDates.some(date => date >= formatDateOnly(addDays(today, period === '7d' ? -6 : -27)) && date <= formatDateOnly(today)) ? (
        <div className="ht-empty-card">
          <h3>No trend data yet.</h3>
          <p>There are no drinking records in this period. Missing records do not mean no alcohol was consumed.</p>
        </div>
      ) : (
        <>
          <div className="trend-kpi-grid">
            <article className="trend-kpi-card">
              <span>{period === '4w' ? 'Avg. standard drinks / week' : 'Recorded standard drinks'}</span>
              <strong>{data.currentAvgStandardDrinks.toFixed(1)}</strong>
              <small>{getPeriodLabel(period)}</small>
            </article>
            <article className="trend-kpi-card">
              <span>{period === '4w' ? 'Avg. drinking days / week' : 'Recorded drinking days'}</span>
              <strong>{data.currentAvgDrinkingDays.toFixed(period === '4w' ? 1 : 0)}</strong>
              <small>{getPeriodLabel(period)}</small>
            </article>
          </div>

          <article className="ht-card">
            <div className="ht-card-heading">
              <div>
                <p className="ht-card-kicker">Consumption trend</p>
                <h3>{period === '7d' ? 'Daily standard drinks' : 'Weekly standard drinks'}</h3>
              </div>
              <span className="ht-benchmark-chip">{daily !== null && weekly !== null ? 'NHMRC reference' : 'Reference unavailable'}</span>
            </div>
            <TrendBars values={data.chartValues} guideline={data.guideline} />
            <div className="trend-comparison">
              <span className="trend-comparison-icon" aria-hidden="true">↕</span>
              <p>{data.comparison}</p>
            </div>
          </article>

          <article className="ht-card">
            <div className="ht-card-heading">
              <div>
                <p className="ht-card-kicker">Drinking patterns</p>
                <h3>When your recorded drinking most often occurs</h3>
              </div>
            </div>
            <div className="trend-pattern-grid">
              <div>
                <span>Most common drinking day</span>
                <strong>{data.mostCommonDay}</strong>
              </div>
              <div>
                <span>Most common drinking time</span>
                <strong>{data.mostCommonTime}</strong>
              </div>
            </div>
          </article>

          <article className="trend-insight-card">
            <div>
              <span>Highest recorded day</span>
              <strong>{data.highestDay.toFixed(1)} standard drinks</strong>
            </div>
            <div>
              <span>Recorded days above {daily ?? 'unavailable'} standard drinks</span>
              <strong>{data.daysAboveFour ?? 'Unavailable'}</strong>
            </div>
          </article>
        </>
      )}
      <ReportDownloadSection records={records} daily={daily} weekly={weekly} />
    </section>
  )
}

function ReportDownloadSection({ records, daily, weekly }: Pick<Props, 'records' | 'daily' | 'weekly'>) {
  const today = useMemo(() => startOfToday(), [])
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
    <section className="ht-card trend-report-download" aria-labelledby="report-heading">
      <h3 id="report-heading">Your drinking report</h3>
      <p>Download a summary of your recorded drinking to discuss with your GP or healthcare professional.</p>
      {!canGenerate ? (
        <div className="trend-report-eligibility">
          <h4>Not enough history yet</h4>
          <p>Your health report will be available after you have at least 4 weeks of recorded drinking history.</p>
          <div className="report-progress" aria-label={`${Math.min(historySpanDays, 28)} of 28 days of history available`}>
            <div style={{ width: `${Math.min(100, (historySpanDays / 28) * 100)}%` }} />
          </div>
          <small>{Math.min(historySpanDays, 28)} of 28 days</small>
        </div>
      ) : (
        <button type="button" className="ht-primary-button trend-report-download-button" onClick={exportPdf}>Download Report (PDF)</button>
      )}
      {exportError && <p role="alert">{exportError}</p>}
      <p className="trend-report-disclaimer">This report is based on alcohol consumption recorded by the user in SipAware. It may not represent all alcohol consumed and is not a medical diagnosis.</p>
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
 const readTab = (): HistoryTrendsTab => window.location.hash === '#trends' || window.location.hash === '#report' ? 'trends' : 'history'
 const [activeTab, setActiveTab] = useState<HistoryTrendsTab>(readTab)
 const [notice, setNotice] = useState<string | null>(null)
 const [editingId, setEditingId] = useState<string | null>(null)
 const historyViewRef = useRef<HTMLElement>(null)
 const historyScroll = useRef<NavigationScrollPosition | null>(null)
 const openRecordEditor = (id: string) => {
  historyScroll.current = captureNavigationScroll(historyViewRef.current)
  prepareNavigationScroll()
  setEditingId(id)
  requestNavigationScroll({ kind: 'top' })
 }
 const closeRecordEditor = () => {
  prepareNavigationScroll()
  setEditingId(null)
  requestNavigationScroll(historyScroll.current
   ? { kind: 'restore', position: historyScroll.current } : { kind: 'preserve' })
 }
 const views = records.map(projectHistoryRecord)
 const [historySelection, setHistorySelection] = useState(() => initialHistorySelection(views, todayKey, checkInHistory.alcoholFreeDates ?? [], checkInHistory.initialDateKey, initialRecordId))
 useEffect(() => {
  const restore = () => { setActiveTab(readTab()); setEditingId(null) }
  window.addEventListener('hashchange', restore); window.addEventListener('popstate', restore)
  return () => { window.removeEventListener('hashchange', restore); window.removeEventListener('popstate', restore) }
 }, [])
 useEffect(() => {
  if (activeTab === 'trends' && !editingId) void updateAwardsAfterCheckIn({ viewedTrends: true })
 }, [activeTab, editingId, records, checkInHistory.alcoholFreeDates, todayKey])
 const eligible = views.filter(record => record.date <= todayKey)
 const editingRecord = records.find(record => record.id === editingId)
 const daily = guidelineStatus === 'loaded' ? guidelines?.guidelines.find(g => g.guidelineType === 'DAILY')?.thresholdStandardDrinks ?? null : null
 const weekly = guidelineStatus === 'loaded' ? guidelines?.guidelines.find(g => g.guidelineType === 'WEEKLY')?.thresholdStandardDrinks ?? null : null
 const source = guidelines?.guidelines.find(g => g.guidelineType === 'DAILY')?.source
 if (editingRecord) return <section ref={historyViewRef} className="reference-history-edit reference-edit-page">
  <ReferenceBackBar label="Back to History" onClick={closeRecordEditor} />
  <h1>Edit Record</h1><p>Update this drinking record.</p>
  <DrinkingRecordEditor presentation="reference" record={editingRecord} referenceCategories={referenceCategories}
   onSave={async updated => { await onUpdate(updated); setNotice('The drinking record for ' + updated.drinkName + ' was updated.'); closeRecordEditor() }} onCancel={closeRecordEditor} />
 </section>
 return <section ref={historyViewRef} className="history-trends-page" aria-label="History & Trends">
  <div className="history-trends-inner">
   {notice && <p className="reference-sr-only" role="status">{notice}</p>}
   <header className="history-trends-header reference-page-heading"><h1>History &amp; Trends</h1></header>
   <nav className="history-trends-tabs" aria-label="History and trends sections">
    {(['history', 'trends'] as const).map(tab => <button key={tab} type="button"
     className={activeTab === tab ? 'active' : ''} aria-current={activeTab === tab ? 'page' : undefined}
     onClick={() => { window.history.pushState({ ...window.history.state }, '', applicationHref('/trends#' + tab)); window.dispatchEvent(new PopStateEvent('popstate')) }}>
     {tab[0].toUpperCase() + tab.slice(1)}</button>)}
   </nav>
   {activeTab === 'history' && <HistoryTab {...checkInHistory} todayKey={todayKey} records={views}
    selection={historySelection} onSelectionChange={setHistorySelection} daily={daily} weekly={weekly}
    onDeleteRecord={onDelete} onEditRecord={record => openRecordEditor(record.id)} />}
   {activeTab === 'trends' && <TrendsTab key={todayKey} alcoholFreeDates={checkInHistory.alcoholFreeDates} records={eligible} daily={daily} weekly={weekly} />}
   {activeTab !== 'history' && <footer className="ht-recorded-data-note">
    <p>Based on drinks recorded on this device. Missing records do not mean no alcohol was consumed. Future-dated records are excluded from feedback.</p>
    <p>Guideline comparisons use unrounded totals and are not a guarantee of safety or a medical diagnosis.</p>
    {source && guidelineStatus === 'loaded' && <a href={source.url} target="_blank" rel="noreferrer">Source: {source.organisation}</a>}
    {guidelineStatus === 'loading' && <p role="status">Loading Australian guideline comparisons...</p>}
    {guidelineStatus === 'failed' && <div role="alert">Australian guideline values are temporarily unavailable.
      <button type="button" className="ht-secondary-button" onClick={onRetryGuidelines}>Retry guideline comparison</button></div>}
   </footer>}
  </div>
 </section>
}
