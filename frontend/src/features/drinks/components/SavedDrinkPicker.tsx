/**
 * Presents reusable My Drinks templates for selection and management.
 *
 * The component never opens IndexedDB itself. It reports validated edits and
 * confirmed deletions through callbacks, preserving the page's repository
 * boundary and the separation from historical DrinkingRecords.
 */
import type { CatalogProduct } from '../catalog/catalogApi'
import { useState } from 'react'
import { ReferenceRecordBrowser, DrinkThumb, IcoChevron } from './ReferenceRecordBrowser'

import { getDrinkTypeLabel } from '../config/drinkTypes'
import type { DrinkReferenceCategory } from '../types/drinkReference'
import type { SavedDrink } from '../types/savedDrink'
import { SavedDrinkEditor } from './SavedDrinkEditor'
import { ReferenceDialog } from './ReferenceDialog'

interface SavedDrinkPickerProps {
  browserActions?: { onScan: () => void; onManual: () => void; onProduct: (product: CatalogProduct) => void }
  referenceCategories: readonly DrinkReferenceCategory[]
  savedDrinks: readonly SavedDrink[]
  selectedSavedDrinkId: string | null
  onSelect: (savedDrink: SavedDrink) => void
  onClear: () => void
  onUpdate: (savedDrink: SavedDrink) => void | Promise<void>
  onDelete: (savedDrinkId: string) => void | Promise<void>
}

type ManagementStatus =
  | { kind: 'success' | 'error'; message: string }
  | null

export function SavedDrinkPicker({
  browserActions,
  referenceCategories,
  savedDrinks,
  selectedSavedDrinkId,
  onSelect,
  onClear,
  onUpdate,
  onDelete,
}: SavedDrinkPickerProps) {
  const [editingSavedDrinkId, setEditingSavedDrinkId] = useState<string | null>(
    null,
  )
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deletingSavedDrinkId, setDeletingSavedDrinkId] = useState<
    string | null
  >(null)
  const [managementStatus, setManagementStatus] =
    useState<ManagementStatus>(null)
  const selectedSavedDrink = savedDrinks.find(
    (savedDrink) => savedDrink.id === selectedSavedDrinkId,
  )

  function beginEditing(savedDrinkId: string) {
    setEditingSavedDrinkId(savedDrinkId)
    setPendingDeleteId(null)
    setManagementStatus(null)
  }

  async function saveEditedDrink(savedDrink: SavedDrink) {
    // Editing changes only the reusable template. If it is currently selected,
    // ManualDrinkForm separately refreshes the prefilled reusable controls.
    await onUpdate(savedDrink)
    setEditingSavedDrinkId(null)
    setManagementStatus({
      kind: 'success',
      message: `${savedDrink.drinkName} was updated in My Drinks.`,
    })
  }

  function requestDelete(savedDrinkId: string) {
    setPendingDeleteId(savedDrinkId)
    setEditingSavedDrinkId(null)
    setManagementStatus(null)
  }

  /**
   * Delete only after explicit confirmation of the history boundary.
   * The callback targets the SavedDrink repository, so persisted historical
   * DrinkingRecords remain unchanged and continue displaying their snapshots.
   */
  async function confirmDelete(savedDrink: SavedDrink) {
    setDeletingSavedDrinkId(savedDrink.id)
    try {
      await onDelete(savedDrink.id)
    } catch {
      setDeletingSavedDrinkId(null)
      setManagementStatus({
        kind: 'error',
        message:
          'This drink could not be deleted from My Drinks on this device. Nothing was changed.',
      })
      return
    }

    setDeletingSavedDrinkId(null)
    setPendingDeleteId(null)
    setManagementStatus({
      kind: 'success',
      message: `${savedDrink.drinkName} was deleted from My Drinks. Past drinking records were not changed.`,
    })
  }

  const renderCards = (drinks: readonly SavedDrink[]) => (
        <ul className="saved-drinks-list">
          {drinks.map((savedDrink) => (
            <li key={savedDrink.id}>
              <article className="saved-drink-item">
                <button
                  className="saved-drink-button"
                  type="button"
                  aria-pressed={savedDrink.id === selectedSavedDrinkId}
                  onClick={() => onSelect(savedDrink)}
                >
                  <DrinkThumb type={savedDrink.drinkType} />
                  <span className="prototype-card-copy"><strong>{savedDrink.drinkName}</strong>
                  <span>
                    {getDrinkTypeLabel(
                      savedDrink.drinkType,
                      referenceCategories,
                    )}{' '}
                    -{' '}
                    {savedDrink.servingVolumeMl} mL - {savedDrink.abvPercent}%
                    {' '}ABV
                  </span></span><IcoChevron />
                </button>

                <div className="saved-drink-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    aria-label={`Edit ${savedDrink.drinkName}`}
                    onClick={() => beginEditing(savedDrink.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    aria-label={`Delete ${savedDrink.drinkName} from My Drinks`}
                    onClick={() => requestDelete(savedDrink.id)}
                  >
                    Delete
                  </button>
                </div>

                {!browserActions && editingSavedDrinkId === savedDrink.id && (
                  <SavedDrinkEditor
                    referenceCategories={referenceCategories}
                    savedDrink={savedDrink}
                    onSave={saveEditedDrink}
                    onCancel={() => setEditingSavedDrinkId(null)}
                  />
                )}

                {!browserActions && pendingDeleteId === savedDrink.id && (
                  <div className="delete-confirmation" role="alert">
                    <p>
                      <strong>
                        Delete {savedDrink.drinkName} from My Drinks?
                      </strong>
                    </p>
                    <p>This will not delete past drinking records.</p>
                    <div className="management-actions">
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => confirmDelete(savedDrink)}
                        disabled={deletingSavedDrinkId === savedDrink.id}
                      >
                        Yes, delete {savedDrink.drinkName} from My Drinks
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                      >
                        Keep {savedDrink.drinkName}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
  )

  const editing = savedDrinks.find(drink => drink.id === editingSavedDrinkId)
  const pending = savedDrinks.find(drink => drink.id === pendingDeleteId)
  return (
    <section
      className={`my-drinks-panel${savedDrinks.length === 0 ? ' my-drinks-panel--empty' : ''}`}
      aria-labelledby="my-drinks-title"
    >
      {!browserActions && <div className="my-drinks-heading">
        <p className="section-kicker">Quick record</p>
        <h3 id="my-drinks-title">My Drinks</h3>
        <p>
          Choose a saved drink to load its reusable details, then enter this
          occasion&apos;s servings, date and time.
        </p>
      </div>}

      {managementStatus && !(browserActions && pending) && (
        <div
          className={`management-notice management-notice--${managementStatus.kind}`}
          role={managementStatus.kind === 'error' ? 'alert' : 'status'}
        >
          {managementStatus.message}
        </div>
      )}

      {browserActions && editing && <section className="reference-edit-page">
        <button className="prototype-back" type="button" onClick={() => setEditingSavedDrinkId(null)}>‹ Back to My Drinks</button>
        <h1>Edit Drink</h1><SavedDrinkEditor key={editing.id} referenceCategories={referenceCategories} savedDrink={editing} onSave={saveEditedDrink} onCancel={() => setEditingSavedDrinkId(null)} />
      </section>}
      {browserActions && pending && <ReferenceDialog title="Delete this drink?" alert onClose={() => { if (!deletingSavedDrinkId) setPendingDeleteId(null) }}>
        <p>{pending.drinkName} will be removed from My Drinks. Your previous drinking records will be kept.</p>
        {managementStatus?.kind === 'error' && <p role="alert" className="management-notice management-notice--error">{managementStatus.message}</p>}
        <div className="reference-dialog-actions">
          <button type="button" disabled={Boolean(deletingSavedDrinkId)}
           onClick={() => setPendingDeleteId(null)}>Cancel</button>
          <button type="button" disabled={Boolean(deletingSavedDrinkId)}
           onClick={() => confirmDelete(pending)}>{deletingSavedDrinkId ? 'Deleting…' : 'Delete'}</button>
       </div>
      </ReferenceDialog>}
      {browserActions ? <div hidden={Boolean(editing)}><ReferenceRecordBrowser savedDrinks={savedDrinks} onScan={browserActions.onScan} onManual={browserActions.onManual} onProduct={browserActions.onProduct}>{renderCards}</ReferenceRecordBrowser></div> : savedDrinks.length === 0 ? (
        <p className="empty-state">
          No saved drinks yet. Enter drink details and choose Save this
          drink to My Drinks.
        </p>
      ) : (
        renderCards(savedDrinks)
      )}

      {selectedSavedDrink && !browserActions && (
        <div className="selected-drink-notice" role="status">
          <p>
            <strong>Using {selectedSavedDrink.drinkName} from My Drinks.</strong>{' '}
            The saved details are filled in below and your saved drink will
            remain unchanged.
          </p>
          <button className="text-button" type="button" onClick={onClear}>
            Enter drink manually instead
          </button>
        </div>
      )}
    </section>
  )
}
