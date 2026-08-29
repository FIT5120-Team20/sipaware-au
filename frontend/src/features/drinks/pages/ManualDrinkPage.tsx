import { useEffect, useMemo, useRef, useState } from 'react'

import { ManualDrinkForm } from '../components/ManualDrinkForm'
import { RecentDrinkingRecords } from '../components/RecentDrinkingRecords'
import { IndexedDbDrinkingRecordRepository } from '../storage/drinkingRecordRepository'
import { IndexedDbSavedDrinkRepository } from '../storage/savedDrinkRepository'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { SavedDrink } from '../types/savedDrink'
import '../manualDrink.css'

type HydrationStatus = 'loading' | 'ready' | 'error'

export function ManualDrinkPage() {
  const drinkingRecordRepository = useMemo(
    () => new IndexedDbDrinkingRecordRepository(),
    [],
  )
  const savedDrinkRepository = useMemo(
    () => new IndexedDbSavedDrinkRepository(),
    [],
  )
  const isMounted = useRef(false)
  const [records, setRecords] = useState<DrinkingRecord[]>([])
  const [savedDrinks, setSavedDrinks] = useState<SavedDrink[]>([])
  const [hydrationStatus, setHydrationStatus] =
    useState<HydrationStatus>('loading')

  useEffect(() => {
    isMounted.current = true

    async function hydrateBrowserData() {
      try {
        // Read both personal-data stores before showing the feature so the UI
        // starts from one consistent browser-local persistence snapshot.
        const [storedRecords, storedSavedDrinks] = await Promise.all([
          drinkingRecordRepository.list(),
          savedDrinkRepository.list(),
        ])

        if (isMounted.current) {
          setRecords(storedRecords)
          setSavedDrinks(storedSavedDrinks)
          setHydrationStatus('ready')
        }
      } catch {
        if (isMounted.current) {
          setHydrationStatus('error')
        }
      }
    }

    void hydrateBrowserData()

    return () => {
      // IndexedDB can resolve after navigation; committed data remains intact,
      // but React state must not be updated after this page unmounts.
      isMounted.current = false
    }
  }, [drinkingRecordRepository, savedDrinkRepository])

  async function saveRecord(record: DrinkingRecord): Promise<void> {
    const persistedRecords = await drinkingRecordRepository.add(record)
    if (isMounted.current) {
      setRecords(persistedRecords)
    }
  }

  async function updateRecord(record: DrinkingRecord): Promise<void> {
    const persistedRecords = await drinkingRecordRepository.update(record)
    if (isMounted.current) {
      setRecords(persistedRecords)
    }
  }

  async function deleteRecord(recordId: string): Promise<void> {
    const persistedRecords = await drinkingRecordRepository.delete(recordId)
    if (isMounted.current) {
      setRecords(persistedRecords)
    }
  }

  async function saveDrinkForFutureUse(
    savedDrink: SavedDrink,
  ): Promise<void> {
    const persistedSavedDrinks = await savedDrinkRepository.add(savedDrink)
    if (isMounted.current) {
      setSavedDrinks(persistedSavedDrinks)
    }
  }

  async function updateSavedDrink(savedDrink: SavedDrink): Promise<void> {
    const persistedSavedDrinks = await savedDrinkRepository.update(savedDrink)
    if (isMounted.current) {
      setSavedDrinks(persistedSavedDrinks)
    }
  }

  async function deleteSavedDrink(savedDrinkId: string): Promise<void> {
    const persistedSavedDrinks = await savedDrinkRepository.delete(savedDrinkId)
    if (isMounted.current) {
      setSavedDrinks(persistedSavedDrinks)
    }
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

        {hydrationStatus === 'loading' && (
          <section className="manual-drink-card" role="status">
            Loading drinks saved on this device...
          </section>
        )}

        {hydrationStatus === 'error' && (
          <section className="manual-drink-card">
            <div className="form-notice form-notice--error" role="alert">
              Drinks saved on this device could not be loaded. Reload the page
              to try again. Nothing has been changed.
            </div>
          </section>
        )}

        {hydrationStatus === 'ready' && (
          <div className="manual-drink-layout">
            <ManualDrinkForm
              savedDrinks={savedDrinks}
              onSave={saveRecord}
              onSaveSavedDrink={saveDrinkForFutureUse}
              onUpdateSavedDrink={updateSavedDrink}
              onDeleteSavedDrink={deleteSavedDrink}
            />
            <RecentDrinkingRecords
              records={records}
              onUpdate={updateRecord}
              onDelete={deleteRecord}
            />
          </div>
        )}
      </div>
    </main>
  )
}
