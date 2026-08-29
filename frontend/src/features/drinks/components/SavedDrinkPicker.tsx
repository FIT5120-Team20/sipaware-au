/**
 * Presents reusable My Drinks templates for selection and management.
 *
 * The component never opens IndexedDB itself. It reports validated edits and
 * confirmed deletions through callbacks, preserving the page's repository
 * boundary and the separation from historical DrinkingRecords.
 */
import { useState } from 'react'

import { getDrinkTypeLabel } from '../config/drinkTypes'
import type { SavedDrink } from '../types/savedDrink'
import { SavedDrinkEditor } from './SavedDrinkEditor'

interface SavedDrinkPickerProps {
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

  return (
    <section className="my-drinks-panel" aria-labelledby="my-drinks-title">
      <div className="my-drinks-heading">
        <p className="section-kicker">Quick record</p>
        <h3 id="my-drinks-title">My Drinks</h3>
        <p>
          Choose a saved drink to load its reusable details, then enter this
          occasion&apos;s servings, date and time.
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

      {savedDrinks.length === 0 ? (
        <p className="empty-state">
          No saved drinks yet. Enter drink details below and choose Save this
          drink to My Drinks.
        </p>
      ) : (
        <ul className="saved-drinks-list">
          {savedDrinks.map((savedDrink) => (
            <li key={savedDrink.id}>
              <article className="saved-drink-item">
                <button
                  className="saved-drink-button"
                  type="button"
                  aria-pressed={savedDrink.id === selectedSavedDrinkId}
                  onClick={() => onSelect(savedDrink)}
                >
                  <strong>{savedDrink.drinkName}</strong>
                  <span>
                    {getDrinkTypeLabel(savedDrink.drinkType)} -{' '}
                    {savedDrink.servingVolumeMl} mL - {savedDrink.abvPercent}%
                    {' '}ABV
                  </span>
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
                    Delete from My Drinks
                  </button>
                </div>

                {editingSavedDrinkId === savedDrink.id && (
                  <SavedDrinkEditor
                    savedDrink={savedDrink}
                    onSave={saveEditedDrink}
                    onCancel={() => setEditingSavedDrinkId(null)}
                  />
                )}

                {pendingDeleteId === savedDrink.id && (
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
      )}

      {selectedSavedDrink && (
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
