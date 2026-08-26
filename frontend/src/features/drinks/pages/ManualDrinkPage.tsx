import { useMemo, useState } from 'react'

import { ManualDrinkForm } from '../components/ManualDrinkForm'
import { RecentDrinkingRecords } from '../components/RecentDrinkingRecords'
import { LocalStorageDrinkingRecordRepository } from '../storage/drinkingRecordRepository'
import { LocalStorageSavedDrinkRepository } from '../storage/savedDrinkRepository'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { SavedDrink } from '../types/savedDrink'
import '../manualDrink.css'

export function ManualDrinkPage() {
  const drinkingRecordRepository = useMemo(
    () => new LocalStorageDrinkingRecordRepository(),
    [],
  )
  const savedDrinkRepository = useMemo(
    () => new LocalStorageSavedDrinkRepository(),
    [],
  )
  const [records, setRecords] = useState<DrinkingRecord[]>(() =>
    drinkingRecordRepository.list(),
  )
  const [savedDrinks, setSavedDrinks] = useState<SavedDrink[]>(() =>
    savedDrinkRepository.list(),
  )

  function saveRecord(record: DrinkingRecord) {
    setRecords(drinkingRecordRepository.add(record))
  }

  function saveDrinkForFutureUse(savedDrink: SavedDrink) {
    setSavedDrinks(savedDrinkRepository.add(savedDrink))
  }

  function updateSavedDrink(savedDrink: SavedDrink) {
    setSavedDrinks(savedDrinkRepository.update(savedDrink))
  }

  function deleteSavedDrink(savedDrinkId: string) {
    setSavedDrinks(savedDrinkRepository.delete(savedDrinkId))
  }

  return (
    <main className="manual-drink-page">
      <div className="manual-drink-shell">
        <header className="feature-header">
          <p className="brand-name">SipAware AU</p>
          <h1>Record a drink</h1>
          <p>
            Record what you drank and how much you consumed. Your drinking
            records are saved only in this browser on this device.
          </p>
        </header>

        <div className="manual-drink-layout">
          <ManualDrinkForm
            savedDrinks={savedDrinks}
            onSave={saveRecord}
            onSaveSavedDrink={saveDrinkForFutureUse}
            onUpdateSavedDrink={updateSavedDrink}
            onDeleteSavedDrink={deleteSavedDrink}
          />
          <RecentDrinkingRecords records={records} />
        </div>
      </div>
    </main>
  )
}
