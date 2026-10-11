import { useState } from 'react'
import type { HistoryDateGroup, HistoryRecord } from '../utils/historyCalendar'
import { ReferenceDialog } from './ReferenceDialog'
import { SipAwareIcon } from './SipAwareIcon'

function formatHistoryDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatTime(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return time
  const [hour, minute] = time.split(':').map(Number)
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

/** Shared original History rows; the calendar adds no status styling here. */
export function HistoryRecordList({ groups, savedDate, onDeleteRecord, onEditRecord }: {
  groups: HistoryDateGroup[]
  savedDate?: string
  onDeleteRecord: (id: string) => Promise<void>
  onEditRecord: (record: HistoryRecord) => void
}) {
  const [pendingDelete, setPendingDelete] = useState<HistoryRecord | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  return <>
    <div className="history-list">
      {groups.map(([date, dayRecords]) => {
        const dailyTotal = dayRecords.reduce((sum, record) => sum + record.standardDrinks, 0)
        return <article className={'history-day' + (date === savedDate ? ' history-day--saved' : '')} key={date} id={'history-day-' + date} tabIndex={-1}>
          <header className="history-day-header">
            <h3>{formatHistoryDate(date)}{date === savedDate && <span className="history-saved-tag">Saved</span>}</h3>
            <div className="history-day-total">
              <span className="history-day-total-number">{dailyTotal.toFixed(1)}</span>
              <span className="history-day-total-unit">standard drinks</span>
            </div>
          </header>
          {dayRecords.length === 0 && <div className="history-check-in-row">
            <span className="history-check-in-mark" aria-hidden="true">✓</span>
            <div className="history-check-in-copy"><strong>Alcohol-free day</strong><small>You confirmed no alcohol.</small></div>
          </div>}
          <div className="history-day-records">
            {dayRecords.map(record => <div className="history-record" id={'history-record-' + record.id} key={record.id}>
              <div className="history-record-main"><strong>{record.drinkName}</strong><span>{formatTime(record.time)}</span></div>
              <div className="history-record-standard-drinks" aria-label={record.standardDrinks.toFixed(1) + ' standard drinks'}>
                <span className="history-record-standard-number">{record.standardDrinks.toFixed(1)}</span>
              </div>
              <div className="history-record-actions">
                <button type="button" aria-label={`Edit ${record.drinkName}`} title="Edit record"
                  onClick={() => onEditRecord(record)}><SipAwareIcon name="edit" /></button>
                <button type="button" className="danger" aria-label={`Delete ${record.drinkName}`} title="Delete record"
                  onClick={() => { setDeleteError(null); setPendingDelete(record) }}><SipAwareIcon name="delete" /></button>
              </div>
            </div>)}
          </div>
        </article>
      })}
    </div>
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
  </>
}
