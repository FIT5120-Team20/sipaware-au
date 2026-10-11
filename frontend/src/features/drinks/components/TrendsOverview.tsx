import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { calculateAlcoholConsumptionSummary } from '../calculations/alcoholConsumptionSummary'
import { formatStandardDrinks } from '../calculations/standardDrinks'
import {
  compareRecordedPeriods, DRIVING_AWARENESS_RULE, DRIVING_OBSERVATION_MS,
  getRecordedDays, localCalendarDate, personalisedRecordedInsight, recentDrivingAwareness,
  recordedProgressMessage, dailyConsumptionPoints,
  type ConsumptionRange, type DailyConsumptionPoint,
} from '../calculations/trendsOverview'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { GuidelineLoadStatus } from '../types/alcoholGuideline'
import type { HistoryRecord } from '../utils/historyCalendar'
import type { LocalCalendarDateKey } from '../utils/localCalendarDate'
import '../trendsOverview.css'

type OverviewProps = {
  records: readonly DrinkingRecord[]
  historyRecords: readonly HistoryRecord[]
  alcoholFreeDates: readonly string[]
  today: LocalCalendarDateKey
  daily: number | null
  weekly: number | null
  guidelineStatus: GuidelineLoadStatus
  guidelineSource?: { url: string; organisation: string }
  onRetryGuidelines: () => void
  children: ReactNode
}

function useObservationTime(records: readonly DrinkingRecord[]) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let timer: number | undefined
    let active = true
    const refresh = () => {
      if (!active) return
      window.clearTimeout(timer)
      const observed = Date.now()
      setNow(observed)
      // Refresh at a record's entry/expiry boundary, and after clock changes or sleep.
      let delay = 60_000
      for (const record of records) {
        const consumed = Date.parse(record.consumedAt)
        const boundary = consumed > observed ? consumed : consumed + DRIVING_OBSERVATION_MS
        if (Number.isFinite(boundary) && boundary >= observed) delay = Math.min(delay, boundary - observed + 1)
      }
      timer = window.setTimeout(refresh, Math.max(1, delay))
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    queueMicrotask(refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [records])
  return now
}

function GuidelineMetric({ title, total, threshold, label }: { title: string; total: number; threshold: number | null; label: string }) {
  const available = threshold !== null && Number.isFinite(threshold) && threshold > 0
  const above = available && total > threshold
  const valueText = `${formatStandardDrinks(total)} recorded standard drinks${available ? `; ${label.toLowerCase()} ${threshold} standard drinks` : '; guideline reference pending'}`
  return <article className={'overview-metric-card' + (above ? ' overview-metric-card--above' : '')}>
    <h3>{title}</h3>
    <p className="overview-metric-value"><strong>{formatStandardDrinks(total)}</strong><span>{available ? `/ ${threshold} SD` : 'SD'}</span></p>
    <div className="overview-guideline-progress" role={available ? 'progressbar' : undefined}
      aria-label={available ? `${title} recorded consumption` : undefined}
      aria-valuemin={available ? 0 : undefined} aria-valuemax={available ? threshold : undefined}
      aria-valuenow={available ? Math.min(total, threshold) : undefined} aria-valuetext={available ? valueText : undefined}
      aria-hidden={!available}>
      <span style={{ width: available ? `${Math.min(100, total / threshold * 100)}%` : '0%' }} />
    </div>
    <p className="overview-metric-caption">{label}</p>
  </article>
}

function dateLabel(date: string, long = false) {
  return localCalendarDate(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', ...(long ? { year: 'numeric' as const } : {}) })
}

function ConsumptionHistoryChart({ points, daily, range, onRangeChange }: {
  points: readonly DailyConsumptionPoint[]; daily: number | null
  range: ConsumptionRange; onRangeChange: (range: ConsumptionRange) => void
}) {
  const descriptionId = useId()
  const reference = daily !== null && Number.isFinite(daily) && daily > 0 ? daily : null
  const maximum = Math.max(reference ?? 0, ...points.map(point => point.total ?? 0), 1)
  const topValue = Math.ceil(maximum * 1.15 / 5) * 5
  const x = (pointIndex: number) => pointIndex / (points.length - 1) * 100
  const y = (total: number) => 100 - total / topValue * 100
  const hasData = points.some(point => point.total !== null)
  const hasMissingDates = points.some(point => point.total === null)
  const ticks = range === 7 ? points.map((_, index) => index) : [0, 7, 14, 21, points.length - 1]
  const statusLabels = { drinking: 'Drinking records', 'alcohol-free': 'No alcohol check-in', unrecorded: 'No record' }

  return <section className="overview-card overview-consumption-history" aria-labelledby="consumption-history-heading">
    <div className="overview-chart-heading">
      <div><h2 id="consumption-history-heading">Consumption History</h2><p className="overview-muted">Daily recorded consumption</p></div>
      <div className="overview-range-selector" role="group" aria-label="Consumption history range">
        {([7, 28] as const).map(days => <button key={days} type="button" aria-pressed={range === days}
          onClick={() => onRangeChange(days)}>{days} days</button>)}
      </div>
    </div>
    {reference !== null && <p className="overview-chart-reference"><span aria-hidden="true" />Daily guideline — {reference} SD</p>}
    <p id={descriptionId} className="reference-sr-only">Daily recorded standard drinks for the last {range} calendar days. No alcohol check-ins are shown as zero. Dates without records are left blank and break the line. Exact values and recording status are available in View chart data.</p>
    <div className="overview-chart-layout">
      <div className="overview-chart-y-axis" aria-hidden="true"><span>{topValue}</span><span>{topValue / 2}</span><span>0</span></div>
      <div className="overview-chart-plot" role="img"
        aria-label={hasData ? 'Daily recorded consumption by date' : 'No records in this period'}
        aria-describedby={descriptionId}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {[0, 50, 100].map(position => <line key={position} className="overview-chart-grid" x1="0" x2="100" y1={position} y2={position} vectorEffect="non-scaling-stroke" />)}
          {reference !== null && <line className="overview-chart-guideline" x1="0" x2="100" y1={y(reference)} y2={y(reference)} vectorEffect="non-scaling-stroke" />}
          {points.slice(1).map((point, pointIndex) => {
            const previous = points[pointIndex]
            if (previous.total === null || point.total === null) return null
            return <line key={point.date} className="overview-chart-line"
              x1={x(pointIndex)} y1={y(previous.total)} x2={x(pointIndex + 1)} y2={y(point.total)} vectorEffect="non-scaling-stroke" />
          })}
        </svg>
        {points.map((point, pointIndex) => point.total === null ? null : <span key={point.date}
          className="overview-chart-dot" style={{ left: x(pointIndex) + '%', top: y(point.total) + '%' }} aria-hidden="true" />)}
        {!hasData && <p className="overview-chart-empty">No records in this period.</p>}
      </div>
      <span className="overview-chart-unit" aria-hidden="true">SD</span>
      <div className={'overview-chart-x-axis' + (range === 7 ? ' overview-chart-x-axis--daily' : '')} aria-hidden="true">
        {ticks.map(tick => {
          const date = points[tick].date
          const calendarDate = localCalendarDate(date)
          return <time key={date} dateTime={date} style={{ left: x(tick) + '%' }}>
            {range === 7 ? <><span>{calendarDate.getDate()}</span><span>{calendarDate.toLocaleDateString('en-AU', { month: 'short' })}</span></> : dateLabel(date)}
          </time>
        })}
      </div>
    </div>
    {hasData && hasMissingDates && <p className="overview-muted overview-data-note">Gaps indicate dates with no record.</p>}
    <details className="overview-explanation"><summary>View chart data</summary>
      <div className="overview-chart-table"><table><caption>Daily recorded standard drinks</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">SD</th><th scope="col">Status</th></tr></thead>
        <tbody>{points.map(point => <tr key={point.date}><th scope="row">{dateLabel(point.date, true)}</th><td>{point.total === null ? 'Unknown' : formatStandardDrinks(point.total)}</td><td>{statusLabels[point.status]}</td></tr>)}</tbody>
      </table></div>
    </details>
  </section>
}

export function TrendsOverview({ records, historyRecords, alcoholFreeDates, today, daily, weekly, guidelineStatus, guidelineSource, onRetryGuidelines, children }: OverviewProps) {
  const [range, setRange] = useState<ConsumptionRange>(28)
  const now = useObservationTime(records)
  const summary = useMemo(() => calculateAlcoholConsumptionSummary(records, today), [records, today])
  const days = useMemo(() => getRecordedDays(historyRecords, alcoholFreeDates, today), [historyRecords, alcoholFreeDates, today])
  const points = useMemo(() => dailyConsumptionPoints(days, today, range), [days, today, range])
  const comparison = useMemo(() => compareRecordedPeriods(days, today), [days, today])
  const insight = useMemo(() => personalisedRecordedInsight(days, today, comparison), [days, today, comparison])
  const awareness = useMemo(() => recentDrivingAwareness(records, now), [records, now])
  const warnings = {
    none: { title: 'No recent records', message: 'No alcohol recorded in the last 12 hours.' },
    caution: { title: 'Driving Caution', message: 'Alcohol consumed earlier may still affect your ability to drive.' },
    risk: { title: 'Driving Risk Warning', message: 'Alcohol may still affect your driving ability. Do not drive.' },
  }
  const warning = warnings[awareness.state]
  const alcoholFreeChange = comparison.alcoholFreeChange === 0 ? 'No change in confirmed alcohol-free days'
    : comparison.alcoholFreeChange > 0 ? `+${comparison.alcoholFreeChange} confirmed alcohol-free days`
      : `${Math.abs(comparison.alcoholFreeChange)} fewer confirmed alcohol-free days`

  return <div className="trends-overview">
    <section className="overview-drinking" aria-labelledby="drinking-overview-heading">
      <h2 id="drinking-overview-heading">Drinking Overview</h2>
      <div className="overview-metric-grid">
        <GuidelineMetric title="Today" total={summary.dailyStandardDrinks} threshold={daily} label="Daily guideline" />
        <GuidelineMetric title="Last 7 days" total={summary.rollingSevenDayStandardDrinks} threshold={weekly} label="Weekly guideline" />
      </div>
      {(daily === null || weekly === null) && <div className="overview-guideline-feedback" role={guidelineStatus === 'failed' ? 'alert' : 'status'}>
        <p>{guidelineStatus === 'loading' ? 'Loading guideline references…' : 'Guideline references are temporarily unavailable. Recorded totals are still shown.'}</p>
        {guidelineStatus !== 'loading' && <button type="button" onClick={onRetryGuidelines}>Retry guidelines</button>}
      </div>}
      {guidelineSource && guidelineStatus === 'loaded' && <a className="overview-guideline-source" href={guidelineSource.url} target="_blank" rel="noreferrer">{guidelineSource.organisation} guideline reference <span aria-hidden="true">↗</span></a>}
    </section>

    <section className={'overview-card overview-driving overview-driving--' + awareness.state} aria-labelledby="driving-awareness-heading">
      <h2 id="driving-awareness-heading">Alcohol &amp; Driving Awareness</h2>
      <p className="overview-driving-total"><strong>{formatStandardDrinks(awareness.total)} SD</strong><span>Last 12 hours</span></p>
      <div className="overview-driving-warning" role="status" aria-live="polite"><strong>{warning.title}</strong><p>{warning.message}</p></div>
      <details className="overview-explanation"><summary>About this warning</summary>
        <p>The total uses the consumption date and time of records within the last {DRIVING_AWARENESS_RULE.windowHours} hours, including drinks entered retrospectively. Earlier alcohol may still affect driving, and effects can continue beyond this window.</p>
        <p>This provisional project warning uses {DRIVING_AWARENESS_RULE.warningStandardDrinks} SD as a trigger. Recorded intake cannot establish your current BAC or whether you are over a legal limit. No warning state confirms it is safe to drive.</p>
      </details>
    </section>

    <ConsumptionHistoryChart points={points} daily={daily} range={range} onRangeChange={setRange} />

    <section className="overview-card overview-progress" aria-labelledby="your-progress-heading">
      <h2 id="your-progress-heading">Your Progress</h2>
      <p className="overview-muted">Last 28 days compared with the previous 28 days</p>
      <p className="overview-progress-result">{recordedProgressMessage(comparison)}</p>
      {comparison.canCompare && <><p className="overview-muted">{formatStandardDrinks(comparison.current.total)} SD compared with {formatStandardDrinks(comparison.previous.total)} SD</p><p className="overview-alcohol-free-change">{alcoholFreeChange}</p></>}
      <details className="overview-explanation"><summary>About this comparison</summary>
        <p>Last period: {dateLabel(comparison.current.start)}–{dateLabel(comparison.current.end)} · {comparison.current.knownDays} of 28 days recorded.</p>
        <p>Previous period: {dateLabel(comparison.previous.start)}–{dateLabel(comparison.previous.end)} · {comparison.previous.knownDays} of 28 days recorded.</p>
        <p>Both periods need a drinking record or an explicit No alcohol check-in on every date before an increase or decrease is shown. Unrecorded days are never counted as alcohol-free.</p>
      </details>
    </section>

    <section className="overview-card overview-insight" aria-labelledby="personalised-insights-heading">
      <h2 id="personalised-insights-heading">Personalised Insights</h2><p>{insight.message}</p>
      <details className="overview-explanation"><summary>How this is calculated</summary><p>{insight.detail}</p></details>
    </section>

    {children}
  </div>
}
