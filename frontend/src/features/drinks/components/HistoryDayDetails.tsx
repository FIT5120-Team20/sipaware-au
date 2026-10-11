import { applicationHref } from '../../../app/entryPaths'
import { displayCheckInDate } from '../types/dailyCheckIn'
import type { HistoryDateGroup, HistoryRecord } from '../utils/historyCalendar'
import { HistoryRecordList } from './HistoryRecordList'
import { SipAwareIcon } from './SipAwareIcon'

/** Selection is read-only; only the Record link starts the existing capture flow. */
export function HistoryDayDetails({ date, group, savedDate, onRecordDate, onDeleteRecord, onEditRecord }: {
  date: string | null
  group?: HistoryDateGroup
  savedDate?: string
  onRecordDate?: (date: string) => void
  onDeleteRecord: (id: string) => Promise<void>
  onEditRecord: (record: HistoryRecord) => void
}) {
  return <section id="history-day-details" className={'history-selected-detail' + (date && !group ? ' history-selected-detail--empty' : '')} hidden={!date} aria-label="Selected day records" aria-live="polite">
    {date && (group ? <HistoryRecordList key={date} groups={[group]} savedDate={savedDate}
        onDeleteRecord={onDeleteRecord} onEditRecord={onEditRecord} />
      : <div className="history-unrecorded-day">
        <h3 className="history-unrecorded-date"><SipAwareIcon name="calendar" /><span>{displayCheckInDate(date)}</span></h3>
        <div className="history-empty-message">
          <h4>No records for this day</h4>
          <p>You haven't recorded any drinking information for this date.</p>
          <a className="history-record-day-link" href={applicationHref('/record?date=' + encodeURIComponent(date))}
            onClick={event => {
              if (!onRecordDate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault(); onRecordDate(date)
            }}>Record this day <span className="history-record-day-arrow">→</span></a>
        </div>
      </div>)}
  </section>
}
