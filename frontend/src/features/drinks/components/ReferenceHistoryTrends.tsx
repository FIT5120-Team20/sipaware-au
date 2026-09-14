/**
 * REUSE: HistoryTrendsPage.tsx / index.css at f5711b15 (rendering and controls).
 * ADAPT: IndexedDB snapshots supply all personal data; original local calendar
 * offsets and full-precision calculation are preserved. Reference thresholds
 * arrive only through the existing validated public API, never sample data.
 */
import { applicationHref } from '../../../app/entryPaths'
import { useEffect, useMemo, useState } from 'react'
import { calculateStandardDrinks } from '../calculations/standardDrinks'
import { getRecordLocalCalendarDateKey, getRecordedLocalWallClockDate, differenceInLocalCalendarDays, type LocalCalendarDateKey } from '../utils/localCalendarDate'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { DrinkReferenceCategory } from '../types/drinkReference'
import type { AlcoholGuidelinesResponseDto, GuidelineLoadStatus } from '../types/alcoholGuideline'
import { DrinkingRecordEditor } from './DrinkingRecordEditor'
import { ReferenceDialog } from './ReferenceDialog'
import { ReferenceBackBar } from './ReferenceBackBar'
import '../referenceHistory.css'

type HistoryTrendsTab = 'history' | 'trends' | 'report'
type TrendPeriod = '7d' | '4w'
type ConsumptionRecord = { id: string; drinkName: string; date: string; time: string; standardDrinks: number }
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

function formatHistoryDate(dateValue: string) {
  return parseDateOnly(dateValue).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatReportDate(dateValue: string) {
  return parseDateOnly(dateValue).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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

function mostCommonDay(records: ConsumptionRecord[]) {
  if (records.length === 0) return 'Not enough data'
  const totals = new Map<number, number>()
  records.forEach((record) => {
    const day = parseDateOnly(record.date).getDay()
    totals.set(day, (totals.get(day) ?? 0) + 1)
  })
  const winner = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (winner === undefined) return 'Not enough data'
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][winner]
}

function mostCommonTime(records: ConsumptionRecord[]) {
  const buckets = new Map<number, number>()
  records.forEach((record) => {
    if (!/^\d{2}:\d{2}$/.test(record.time)) return
    const [hour, minute] = record.time.split(':').map(Number)
    const roundedMinutes = Math.round((hour * 60 + minute) / 30) * 30
    buckets.set(roundedMinutes, (buckets.get(roundedMinutes) ?? 0) + 1)
  })
  const winner = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (winner === undefined) return 'Not enough data'
  const minutesInDay = winner % (24 * 60)
  const hour = Math.floor(minutesInDay / 60)
  const minute = minutesInDay % 60
  const date = new Date(2000, 0, 1, hour, minute)
  return `Around ${date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`
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

type HistoryTabProps = Props & {
  onEditRecord: (record: ConsumptionRecord) => void
}

function HistoryTab({
  records,
  onDeleteRecord,
  onEditRecord,
}: HistoryTabProps) {
  const latestRecordDate = records.length > 0
    ? parseDateOnly([...records].sort((a, b) => b.date.localeCompare(a.date))[0].date)
    : startOfToday()
  const [viewYear, setViewYear] = useState(latestRecordDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(latestRecordDate.getMonth())
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [draftYear, setDraftYear] = useState(viewYear)
  const [draftMonth, setDraftMonth] = useState(viewMonth)
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ConsumptionRecord | null>(null)



  const monthRecords = useMemo(() => {
    return records
      .filter((record) => {
        const date = parseDateOnly(record.date)
        return date.getFullYear() === viewYear && date.getMonth() === viewMonth
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date)
        return b.time.localeCompare(a.time)
      })
  }, [records, viewMonth, viewYear])

  const groupedRecords = useMemo(() => {
    const groups = new Map<string, ConsumptionRecord[]>()
    monthRecords.forEach((record) => {
      const list = groups.get(record.date) ?? []
      list.push(record)
      groups.set(record.date, list)
    })
    return Array.from(groups.entries())
  }, [monthRecords])

  const years = useMemo(() => {
    const current = new Date().getFullYear()
    const recordYears = records.map((record) => parseDateOnly(record.date).getFullYear())
    const min = Math.min(current - 5, ...recordYears)
    const max = Math.max(current, ...recordYears)
    return Array.from({ length: max - min + 1 }, (_, index) => max - index)
  }, [records])

  const moveMonth = (offset: number) => {
    const next = new Date(viewYear, viewMonth + offset, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
    setShowMonthPicker(false)
  }

  const applyMonth = () => {
    setViewYear(draftYear)
    setViewMonth(draftMonth)
    setShowMonthPicker(false)
  }

  return (
    <section className="ht-section" aria-labelledby="history-heading">
      <div className="ht-section-heading-row">
        <h2 id="history-heading" className="ht-section-title">Your drinking records</h2>
      </div>

      <div className="history-month-nav" aria-label="History month navigation">
        <button className="history-month-arrow" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
        <button
          className="history-month-label"
          onClick={() => { setDraftYear(viewYear); setDraftMonth(viewMonth); setShowMonthPicker((value) => !value) }}
          aria-expanded={showMonthPicker}
        >
          {formatMonthLabel(viewYear, viewMonth)}
          <span aria-hidden="true">⌄</span>
        </button>
        <button className="history-month-arrow" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
      </div>

      {showMonthPicker && (
        <div className="history-month-picker">
          <label>
            <span>Year</span>
            <select aria-label="Year" value={draftYear} onChange={(event) => setDraftYear(Number(event.target.value))}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>
            <span>Month</span>
            <select aria-label="Month" value={draftMonth} onChange={(event) => setDraftMonth(Number(event.target.value))}>
              {MONTH_NAMES.map((month, index) => <option key={month} value={index}>{month}</option>)}
            </select>
          </label>
          <button className="ht-primary-button" onClick={applyMonth}>Apply</button>
        </div>
      )}

      {groupedRecords.length === 0 ? (
        <div className="ht-empty-card">
          <h3>No drinking records for {MONTH_NAMES[viewMonth]}.</h3>
          <p>Records you add will appear here.</p>
        </div>
      ) : (
        <div className="history-list">
          {groupedRecords.map(([date, dayRecords]) => {
            const dailyTotal = (dayRecords.reduce((sum, record) => sum + record.standardDrinks, 0))
            return (
              <article className="history-day" key={date}>
                <header className="history-day-header">
                  <h3>{formatHistoryDate(date)}</h3>
                  <div className="history-day-total">
                    <span className="history-day-total-number">{dailyTotal.toFixed(1)}</span>
                    <span className="history-day-total-unit">standard drinks</span>
                  </div>
                </header>
                <div className="history-day-records">
                  {dayRecords.map((record) => (
                    <div className="history-record" key={record.id}>
                      <div className="history-record-main">
                        <strong>{record.drinkName}</strong>
                        <span>{formatTime(record.time)}</span>
                      </div>
                      <div className="history-record-standard-drinks">
                        <span className="history-record-standard-number">{record.standardDrinks.toFixed(1)}</span>
                      </div>
                      <button
                        className="history-record-menu"
                        aria-label={`Actions for ${record.drinkName}`}
                        onClick={() => setOpenActionsId((id) => id === record.id ? null : record.id)}
                      >
                        ⋯
                      </button>
                      {openActionsId === record.id && (
                        <div className="history-record-actions">
                          <button onClick={() => { onEditRecord(record); setOpenActionsId(null) }}>Edit</button>
                          <button className="danger" onClick={() => { setPendingDelete(record); setOpenActionsId(null) }}>Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}


      {pendingDelete && <ReferenceDialog title="Delete this record?" alert onClose={() => { if (!deleting) { setPendingDelete(null); setDeleteError(null) } }}>
        <p>This removes this record from your drinking history, Trends, and Report. My Drinks will not be changed.</p>
        {deleteError && <p role="alert">{deleteError}</p>}
        <div className="reference-dialog-actions">
          <button type="button" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancel</button>
          <button type="button" disabled={deleting} onClick={async () => {
            setDeleting(true); setDeleteError(null)
            try { await onDeleteRecord(pendingDelete.id); setPendingDelete(null) }
            catch { setDeleteError('This record could not be deleted. It remains saved on this device. Try again.') }
            finally { setDeleting(false) }
          }}>{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </ReferenceDialog>}

    </section>
  )
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
            <div className="trend-bar-column" key={item.label}>
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

function TrendsTab({ records, daily, weekly }: Pick<Props, 'records' | 'daily' | 'weekly'>) {
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

      {records.length === 0 ? (
        <div className="ht-empty-card">
          <h3>No trend data yet.</h3>
          <p>Record drinks to build your personal drinking trends.</p>
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
    </section>
  )
}

function ReportTab({ records, daily, weekly }: Pick<Props, 'records' | 'daily' | 'weekly'>) {
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

  const exportPdf = () => {
    window.print()
  }

  return (
    <section className="ht-section report-section" aria-labelledby="report-heading">
      <div className="ht-section-heading-row report-screen-only">
        <div>
          <h2 id="report-heading" className="ht-section-title">Four-week drinking report</h2>
        </div>
      </div>

      {!canGenerate ? (
        <div className="ht-empty-card report-screen-only">
          <h3>Not enough history yet</h3>
          <p>Your health report will be available after you have at least 4 weeks of recorded drinking history.</p>
          <div className="report-progress" aria-label={`${Math.min(historySpanDays, 28)} of 28 days of history available`}>
            <div style={{ width: `${Math.min(100, (historySpanDays / 28) * 100)}%` }} />
          </div>
          <small>{Math.min(historySpanDays, 28)} of 28 days</small>
        </div>
      ) : (
        <div className="report-print-area">
          <header className="report-title-block">
            <div>
              <h2>SipAware Drinking Report</h2>
              <p>A clear summary of your recorded drinking history and trends to help your GP or another healthcare professional understand your drinking patterns more quickly.</p>
            </div>
            <button className="ht-primary-button report-export-button report-screen-only" onClick={exportPdf}>Export PDF</button>
          </header>

          <div className="report-meta-grid">
            <div>
              <span>Reporting period</span>
              <strong>{formatReportDate(formatDateOnly(report.start))} – {formatReportDate(formatDateOnly(report.end))}</strong>
            </div>
            <div>
              <span>Generated</span>
              <strong>{new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </div>
            <div>
              <span>Recorded drinking days</span>
              <strong>{report.recordedDays}</strong>
            </div>
          </div>

          <section className="report-block">
            <div className="report-block-heading">
              <p className="ht-card-kicker">Key drinking summary</p>
              <h3>Four-week overview</h3>
            </div>
            <div className="report-metric-grid">
              <div><span>Avg. recorded standard drinks / week</span><strong>{report.avgPerWeek.toFixed(1)}</strong></div>
              <div><span>Avg. recorded drinking days / week</span><strong>{report.avgDrinkingDaysPerWeek.toFixed(1)}</strong></div>
              <div><span>Avg. standard drinks / recorded drinking day</span><strong>{report.avgPerDrinkingDay.toFixed(1)}</strong></div>
              <div><span>Highest recorded daily total</span><strong>{report.highestDay.toFixed(1)}</strong></div>
              <div><span>Total recorded standard drinks</span><strong>{report.total.toFixed(1)}</strong></div>
            </div>
          </section>

          <section className="report-block report-guideline-block">
            <div className="report-block-heading">
              <p className="ht-card-kicker">Guideline-related summary</p>
              <h3>Recorded consumption above guideline reference amounts</h3>
            </div>
            <div className="report-guideline-grid">
              <div>
                <strong>{report.daysAboveFour ?? 'Unavailable'}</strong>
                <span>Recorded days above {daily ?? 'unavailable'} standard drinks</span>
              </div>
              <div>
                <strong>{report.weeksAboveTen === null ? 'Unavailable' : report.weeksAboveTen + ' of 4'}</strong>
                <span>Recorded weeks above {weekly ?? 'unavailable'} standard drinks</span>
              </div>
            </div>
          </section>

          <section className="report-block">
            <div className="report-block-heading">
              <p className="ht-card-kicker">Four-week consumption trend</p>
              <h3>Weekly standard drinks</h3>
            </div>
            <TrendBars values={report.values} guideline={weekly} />
          </section>

          <section className="report-block">
            <div className="report-block-heading">
              <p className="ht-card-kicker">Recorded drinking history</p>
              <h3>Daily standard-drink totals</h3>
            </div>
            <div className="report-history-list">
              {report.dailyTotals.map((day) => (
                <div key={day.date}>
                  <span>{formatReportDate(day.date)}</span>
                  <span className="report-history-total">{day.total.toFixed(1)} standard drinks</span>
                </div>
              ))}
            </div>
          </section>

          <aside className="report-disclaimer">
            <strong>About this report</strong>
            <p>This report is based on alcohol consumption recorded by the user in SipAware. It may not represent all alcohol consumed and is not a medical diagnosis.</p>
          </aside>
        </div>
      )}
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
export function ReferenceHistoryTrends({ records, referenceCategories, onUpdate, onDelete, guidelines, guidelineStatus, onRetryGuidelines, todayKey }: {
 records: DrinkingRecord[]; referenceCategories: DrinkReferenceCategory[]
 onUpdate: (record: DrinkingRecord) => Promise<void>; onDelete: (id: string) => Promise<void>
 guidelines: AlcoholGuidelinesResponseDto | null; guidelineStatus: GuidelineLoadStatus; onRetryGuidelines: () => void
 todayKey: string
}) {
 const readTab = (): HistoryTrendsTab => window.location.hash === '#trends' ? 'trends' : window.location.hash === '#report' ? 'report' : 'history'
 const [activeTab, setActiveTab] = useState<HistoryTrendsTab>(readTab)
 const [notice, setNotice] = useState<string | null>(null)
 const [editingId, setEditingId] = useState<string | null>(null)
 useEffect(() => { const restore = () => setActiveTab(readTab()); window.addEventListener('hashchange', restore); window.addEventListener('popstate', restore)
  return () => { window.removeEventListener('hashchange', restore); window.removeEventListener('popstate', restore) } }, [])
 const views = records.map(projectHistoryRecord)
 const eligible = views.filter(record => record.date <= todayKey)
 const editingRecord = records.find(record => record.id === editingId)
 const daily = guidelineStatus === 'loaded' ? guidelines?.guidelines.find(g => g.guidelineType === 'DAILY')?.thresholdStandardDrinks ?? null : null
 const weekly = guidelineStatus === 'loaded' ? guidelines?.guidelines.find(g => g.guidelineType === 'WEEKLY')?.thresholdStandardDrinks ?? null : null
 const source = guidelines?.guidelines.find(g => g.guidelineType === 'DAILY')?.source
 if (editingRecord) return <section className="reference-history-edit reference-edit-page">
  <ReferenceBackBar label="Back to History" onClick={() => setEditingId(null)} />
  <h1>Edit Record</h1><p>Update this drinking record.</p>
  <DrinkingRecordEditor presentation="reference" record={editingRecord} referenceCategories={referenceCategories}
   onSave={async updated => { await onUpdate(updated); setNotice('The drinking record for ' + updated.drinkName + ' was updated.'); setEditingId(null) }} onCancel={() => setEditingId(null)} />
 </section>
 return <section className="history-trends-page" aria-label="History & Trends">
  <div className="history-trends-inner">
   {notice && <p className="reference-sr-only" role="status">{notice}</p>}
   <header className="history-trends-header"><h1>History &amp; Trends</h1></header>
   <nav className="history-trends-tabs" aria-label="History and trends sections">
    {(['history', 'trends', 'report'] as const).map(tab => <button key={tab} type="button"
     className={activeTab === tab ? 'active' : ''} aria-current={activeTab === tab ? 'page' : undefined}
     onClick={() => { window.history.pushState({}, '', applicationHref('/trends#' + tab)); setActiveTab(tab) }}>
     {tab[0].toUpperCase() + tab.slice(1)}</button>)}
   </nav>
   {activeTab === 'history' && <HistoryTab records={views} daily={daily} weekly={weekly} onDeleteRecord={onDelete} onEditRecord={record => setEditingId(record.id)} />}
   {activeTab === 'trends' && <TrendsTab key={todayKey} records={eligible} daily={daily} weekly={weekly} />}
   {activeTab === 'report' && <ReportTab key={todayKey} records={eligible} daily={daily} weekly={weekly} />}
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
