import { getDrinkTypeLabel } from '../config/drinkTypes'
import type { SavedDrink } from '../types/savedDrink'

interface SavedDrinkPickerProps {
  savedDrinks: readonly SavedDrink[]
  selectedSavedDrinkId: string | null
  onSelect: (savedDrink: SavedDrink) => void
  onClear: () => void
}

export function SavedDrinkPicker({
  savedDrinks,
  selectedSavedDrinkId,
  onSelect,
  onClear,
}: SavedDrinkPickerProps) {
  const selectedSavedDrink = savedDrinks.find(
    (savedDrink) => savedDrink.id === selectedSavedDrinkId,
  )

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

      {savedDrinks.length === 0 ? (
        <p className="empty-state">
          No saved drinks yet. Enter drink details below and choose Save this
          drink to My Drinks.
        </p>
      ) : (
        <ul className="saved-drinks-list">
          {savedDrinks.map((savedDrink) => (
            <li key={savedDrink.id}>
              <button
                className="saved-drink-button"
                type="button"
                aria-pressed={savedDrink.id === selectedSavedDrinkId}
                onClick={() => onSelect(savedDrink)}
              >
                <strong>{savedDrink.drinkName}</strong>
                <span>
                  {getDrinkTypeLabel(savedDrink.drinkType)} -{' '}
                  {savedDrink.servingVolumeMl} mL - {savedDrink.abvPercent}% ABV
                </span>
              </button>
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
