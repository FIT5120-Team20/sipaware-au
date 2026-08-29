/**
 * Displays and manages immutable-by-default DrinkingRecord snapshots.
 *
 * Corrections and deletions are delegated to the history repository callbacks;
 * this component never changes My Drinks or talks to IndexedDB directly.
 */
import { useState } from 'react'

import { getDrinkTypeLabel } from '../config/drinkTypes'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { DrinkReferenceCategory } from '../types/drinkReference'
import { formatConsumedDateTime } from '../utils/formatConsumedDateTime'
import { DrinkingRecordEditor } from './DrinkingRecordEditor'

interface RecentDrinkingRecordsProps {
  referenceCategories: readonly DrinkReferenceCategory[]
  records: readonly DrinkingRecord[]
  onUpdate: (record: DrinkingRecord) => void | Promise<void>
  onDelete: (recordId: string) => void | Promise<void>
}

type ManagementStatus =
  | { kind: 'success' | 'error'; message: string }
  | null

const MAX_RECENT_RECORDS = 3

function formatRecordedNumber(value: number): string {
  return String(value)
}

export function RecentDrinkingRecords({
  referenceCategories,
  records,
  onUpdate,
  onDelete,
}: RecentDrinkingRecordsProps) {
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)
  const [managementStatus, setManagementStatus] =
    useState<ManagementStatus>(null)
  // Repositories return oldest-to-newest collections. slice returns a copy, so
  // reversing the newest three here cannot mutate repository-backed page state.
  const recentRecords = records.slice(-MAX_RECENT_RECORDS).reverse()

  function beginEditing(recordId: string) {
    setEditingRecordId(recordId)
    setPendingDeleteId(null)
    setManagementStatus(null)
  }

  async function saveEditedRecord(record: DrinkingRecord) {
    // The corrected value replaces only the selected historical snapshot; no
    // SavedDrink callback or template mutation participates in this workflow.
    await onUpdate(record)
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

  /** Delete only this history ID after the user confirms the store boundary. */
  async function confirmDelete(record: DrinkingRecord) {
    setDeletingRecordId(record.id)
    try {
      await onDelete(record.id)
    } catch {
      setDeletingRecordId(null)
      setManagementStatus({
        kind: 'error',
        message:
          'This drinking record could not be deleted on this device. Nothing was changed.',
      })
      return
    }

    setDeletingRecordId(null)
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
                  <span>
                    {getDrinkTypeLabel(record.drinkType, referenceCategories)}
                  </span>
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
                    referenceCategories={referenceCategories}
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
                        disabled={deletingRecordId === record.id}
                      >
                        Yes, delete record
                      </button>
                      {/* Cancel exits confirmation without calling the repository. */}
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
