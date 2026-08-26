import { useState } from 'react'

import { getDrinkTypeLabel } from '../config/drinkTypes'
import type { DrinkingRecord } from '../types/drinkingRecord'
import { formatConsumedDateTime } from '../utils/formatConsumedDateTime'
import { DrinkingRecordEditor } from './DrinkingRecordEditor'

interface RecentDrinkingRecordsProps {
  records: readonly DrinkingRecord[]
  onUpdate: (record: DrinkingRecord) => void
  onDelete: (recordId: string) => void
}

type ManagementStatus =
  | { kind: 'success' | 'error'; message: string }
  | null

const MAX_RECENT_RECORDS = 3

function formatRecordedNumber(value: number): string {
  return String(value)
}

export function RecentDrinkingRecords({
  records,
  onUpdate,
  onDelete,
}: RecentDrinkingRecordsProps) {
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [managementStatus, setManagementStatus] =
    useState<ManagementStatus>(null)
  const recentRecords = records.slice(-MAX_RECENT_RECORDS).reverse()

  function beginEditing(recordId: string) {
    setEditingRecordId(recordId)
    setPendingDeleteId(null)
    setManagementStatus(null)
  }

  function saveEditedRecord(record: DrinkingRecord) {
    onUpdate(record)
    setEditingRecordId(null)
    setManagementStatus({
      kind: 'success',
      message: `The drinking record for ${record.drinkName} was updated.`,
    })
  }

  function requestDelete(recordId: string) {
    setPendingDeleteId(recordId)
    setEditingRecordId(null)
    setManagementStatus(null)
  }

  function confirmDelete(record: DrinkingRecord) {
    try {
      onDelete(record.id)
    } catch {
      setManagementStatus({
        kind: 'error',
        message:
          'This drinking record could not be deleted on this device. Nothing was changed.',
      })
      return
    }

    setPendingDeleteId(null)
    setManagementStatus({
      kind: 'success',
      message:
        'The drinking record was deleted. Your saved drinks in My Drinks were not changed.',
    })
  }

  return (
    <section
      className="recent-records-card"
      aria-labelledby="recent-records-title"
    >
      <div className="section-heading">
        <p className="section-kicker">Saved on this device</p>
        <h2 id="recent-records-title">Recent records</h2>
        <p>
          View or correct your three most recently saved drinking records.
        </p>
      </div>

      {managementStatus && (
        <div
          className={`management-notice management-notice--${managementStatus.kind}`}
          role={managementStatus.kind === 'error' ? 'alert' : 'status'}
        >
          {managementStatus.message}
        </div>
      )}

      {recentRecords.length === 0 ? (
        <p className="empty-state">No drinks recorded on this device yet.</p>
      ) : (
        <ol className="recent-records-list">
          {recentRecords.map((record) => (
            <li key={record.id}>
              <article className="recent-record">
                <div className="recent-record__heading">
                  <h3>{record.drinkName}</h3>
                  <span>{getDrinkTypeLabel(record.drinkType)}</span>
                </div>

                <dl>
                  <div>
                    <dt>Serving volume</dt>
                    <dd>{formatRecordedNumber(record.servingVolumeMl)} mL</dd>
                  </div>
                  <div>
                    <dt>ABV</dt>
                    <dd>{formatRecordedNumber(record.abvPercent)}%</dd>
                  </div>
                  <div>
                    <dt>Servings consumed</dt>
                    <dd>{formatRecordedNumber(record.amountConsumed)}</dd>
                  </div>
                  <div>
                    <dt>Consumed</dt>
                    <dd>
                      <time dateTime={record.consumedAt}>
                        {formatConsumedDateTime(record)}
                      </time>
                    </dd>
                  </div>
                </dl>

                <div className="recent-record-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    aria-label={`Edit drinking record for ${record.drinkName}`}
                    onClick={() => beginEditing(record.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    aria-label={`Delete drinking record for ${record.drinkName}`}
                    onClick={() => requestDelete(record.id)}
                  >
                    Delete
                  </button>
                </div>

                {editingRecordId === record.id && (
                  <DrinkingRecordEditor
                    record={record}
                    onSave={saveEditedRecord}
                    onCancel={() => setEditingRecordId(null)}
                  />
                )}

                {pendingDeleteId === record.id && (
                  <div className="delete-confirmation" role="alert">
                    <p>
                      <strong>Delete this drinking record?</strong>
                    </p>
                    <p>
                      This removes this record from your drinking history. Your
                      saved drinks in My Drinks will not be changed.
                    </p>
                    <div className="management-actions">
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => confirmDelete(record)}
                      >
                        Yes, delete record
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
