/**
 * Displays and manages immutable-by-default DrinkingRecord snapshots.
 *
 * Corrections and deletions are delegated to the history repository callbacks;
 * this component never changes My Drinks or talks to IndexedDB directly.
 */
import { applicationHref } from '../../../app/entryPaths'
import { useState } from 'react'
import { calculateStandardDrinks, formatStandardDrinks } from '../calculations/standardDrinks'
import { DrinkThumb } from './ReferenceRecordBrowser'
import { ReferenceDialog } from './ReferenceDialog'

import { getDrinkTypeLabel } from '../config/drinkTypes'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { DrinkReferenceCategory } from '../types/drinkReference'
import { formatConsumedDateTime } from '../utils/formatConsumedDateTime'
import { DrinkingRecordEditor } from './DrinkingRecordEditor'
import { SipAwareIcon } from './SipAwareIcon'
import { ReferenceBackBar } from './ReferenceBackBar'

interface RecentDrinkingRecordsProps {
  presentation?: 'default' | 'reference'
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
  presentation = 'default',
  referenceCategories,
  records,
  onUpdate,
  onDelete,
}: RecentDrinkingRecordsProps) {
  const [openActionsId, setOpenActionsId] = useState<string | null>(null)
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

  if (presentation === 'reference') {
    const editing = recentRecords.find(record => record.id === editingRecordId)
    const pending = recentRecords.find(record => record.id === pendingDeleteId)
    if (editing) return <section className="reference-edit-page">
      <ReferenceBackBar label="Back to History" onClick={() => setEditingRecordId(null)} />
      <h1>Edit Record</h1>
      <DrinkingRecordEditor key={editing.id} referenceCategories={referenceCategories} record={editing}
        onSave={saveEditedRecord} onCancel={() => setEditingRecordId(null)} />
    </section>
    return <section className="reference-history-records" aria-labelledby="recent-records-title">
      <h2 id="recent-records-title">Recent records</h2>
      <p>View or correct your three most recently saved drinking records.</p>
      {managementStatus && !pending && <p className={'management-notice management-notice--' + managementStatus.kind} role={managementStatus.kind === 'error' ? 'alert' : 'status'}>{managementStatus.message}</p>}
      {recentRecords.length === 0 ? <div className="reference-history-empty"><h3>No drinking records yet</h3><p>No drinks recorded on this device yet.</p><a href={applicationHref('/record')}>Record a drink</a></div> :
        <ol className="reference-history-list">{recentRecords.map(record => <li key={record.id}>
          <article className="reference-history-row">
            <div className="reference-history-time"><time dateTime={record.consumedAt}>{formatConsumedDateTime(record)}</time></div>
            <div className="reference-history-drink"><DrinkThumb type={record.drinkType} /><div><h3>{record.drinkName}</h3>
              <p>{getDrinkTypeLabel(record.drinkType, referenceCategories)} · {record.abvPercent}% ABV · {record.servingVolumeMl * record.amountConsumed} mL</p>
              <dl className="reference-sr-only"><dt>Serving volume</dt><dd>{record.servingVolumeMl} mL</dd><dt>ABV</dt><dd>{record.abvPercent}%</dd><dt>Servings consumed</dt><dd>{record.amountConsumed}</dd></dl>
            </div></div>
            <div className="reference-history-total"><strong>{formatStandardDrinks(calculateStandardDrinks(record))}</strong><span>standard drinks</span>
              <button type="button" className="reference-history-more" aria-label={'Actions for ' + record.drinkName} aria-expanded={openActionsId === record.id} onClick={() => setOpenActionsId(openActionsId === record.id ? null : record.id)}>⋯</button>
              {openActionsId === record.id && <div className="reference-history-menu">
                <button type="button" aria-label={'Edit drinking record for ' + record.drinkName} onClick={() => { beginEditing(record.id); setOpenActionsId(null) }}>Edit</button>
                <button type="button" aria-label={'Delete drinking record for ' + record.drinkName} onClick={() => { requestDelete(record.id); setOpenActionsId(null) }}>Delete</button>
              </div>}
            </div>
          </article>
        </li>)}</ol>}
      {pending && <ReferenceDialog title="Delete this record?" alert onClose={() => { if (!deletingRecordId) setPendingDeleteId(null) }}>
        <p>This removes this record from your drinking history. Your saved drinks in My Drinks will not be changed.</p>
        {managementStatus?.kind === 'error' && <p role="alert" className="management-notice management-notice--error">{managementStatus.message}</p>}
        <div className="reference-dialog-actions">
         <button type="button" disabled={Boolean(deletingRecordId)}
          onClick={() => setPendingDeleteId(null)}>Cancel</button>
         <button type="button" disabled={Boolean(deletingRecordId)}
          onClick={() => confirmDelete(pending)}>{deletingRecordId ? 'Deleting…' : 'Delete'}</button>
      </div>
      </ReferenceDialog>}
    </section>
  }

  return (
    <section
      className="recent-records-card"
      aria-labelledby="recent-records-title"
    >
      <div className="section-heading recent-records-heading">
        <div className="support-card__heading">
          <span className="support-card__icon support-card__icon--amber">
            <SipAwareIcon name="clock" />
          </span>
          <h2 id="recent-records-title">Recent records</h2>
        </div>
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
                  <h3>
                    <SipAwareIcon name={record.drinkType} />
                    <span>{record.drinkName}</span>
                  </h3>
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
