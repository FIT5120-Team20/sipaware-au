import { displayCheckInDate } from '../types/dailyCheckIn'
import { calendarMonthDates, historyDayStatus, type HistoryDateGroup, type HistoryDayStatus } from '../utils/historyCalendar'
import '../historyCalendar.css'

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const statusLabels: Record<HistoryDayStatus, string> = {
  above: 'Recorded drinking exceeds the daily guideline',
  within: 'Recorded drinking does not exceed the daily guideline',
  'alcohol-free': 'Explicitly confirmed alcohol-free day',
  unrecorded: 'No record saved',
}
const legendLabels: Record<Exclude<HistoryDayStatus, 'unrecorded'>, string> = {
  above: 'Above guideline',
  within: 'Within guideline',
  'alcohol-free': 'Alcohol-free',
}

export function HistoryCalendar({ year, month, today, groups, dailyGuideline, selectedDate, onSelectDate }: {
  year: number
  month: number
  today: string
  groups: HistoryDateGroup[]
  dailyGuideline: number | null
  selectedDate: string | null
  onSelectDate: (date: string) => void
}) {
  const days = calendarMonthDates(year, month)
  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: (string | null)[] = [...Array<string | null>(leading).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  const savedDays = new Map(groups)
  const hasPendingComparisons = days.some(date => historyDayStatus(savedDays.get(date) ?? [], false, dailyGuideline) === null)
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  return <section className="history-calendar-section" aria-label="Monthly history calendar">
    <table className="history-calendar" aria-label={monthLabel + ' calendar'}>
      <thead><tr>{weekdays.map(day => <th key={day} scope="col"><abbr title={day}>{day.slice(0, 3)}</abbr></th>)}</tr></thead>
      <tbody>{Array.from({ length: cells.length / 7 }, (_, week) => <tr key={week}>
        {cells.slice(week * 7, week * 7 + 7).map((date, column) => {
          if (!date) return <td key={column} />
          const records = savedDays.get(date) ?? []
          const status = historyDayStatus(records, savedDays.has(date) && !records.length, dailyGuideline)
          const total = records.reduce((sum, record) => sum + record.standardDrinks, 0)
          const future = date > today
          const statusLabel = status === null ? 'Recorded drinking; guideline comparison pending' : statusLabels[status]
          const label = (date === today ? 'Today, ' : '') + displayCheckInDate(date) + ': ' + statusLabel +
            (records.length ? ', ' + total.toFixed(1) + ' recorded standard drinks' : '') + (future ? '. Future date' : '')
          const className = 'history-calendar-day' + (date === today ? ' history-calendar-day--today' : '') +
            (date === selectedDate ? ' history-calendar-day--selected' : '')
          return <td key={date}>
            <button type="button" className={className} disabled={future}
              data-date={date} data-status={status ?? undefined} data-comparison={status === null ? 'pending' : undefined}
              aria-current={date === today ? 'date' : undefined}
              aria-pressed={date === selectedDate} aria-controls="history-day-details" aria-label={label}
              onClick={() => onSelectDate(date)}>
              <span className="history-calendar-number" aria-hidden="true">{Number(date.slice(-2))}</span>
            </button>
          </td>
        })}
      </tr>)}</tbody>
    </table>
    <ul className="history-calendar-legend" aria-label="Calendar legend">
      {(Object.keys(legendLabels) as (keyof typeof legendLabels)[]).map(status => <li key={status}>
        <span className="history-calendar-swatch" data-status={status} aria-hidden="true" />{legendLabels[status]}
      </li>)}
    </ul>
    {hasPendingComparisons && <p className="history-calendar-comparison-note" role="status">
      Recorded drinking days are shown in grey until the guideline reference is available.
    </p>}
  </section>
}
