import { useMemo, useState } from 'react'

import { ManualDrinkForm } from '../components/ManualDrinkForm'
import { RecentDrinkingRecords } from '../components/RecentDrinkingRecords'
import { LocalStorageDrinkingRecordRepository } from '../storage/drinkingRecordRepository'
import type { DrinkingRecord } from '../types/drinkingRecord'
import '../manualDrink.css'

export function ManualDrinkPage() {
  const repository = useMemo(
    () => new LocalStorageDrinkingRecordRepository(),
    [],
  )
  const [records, setRecords] = useState<DrinkingRecord[]>(() =>
    repository.list(),
  )

  function saveRecord(record: DrinkingRecord) {
    setRecords(repository.add(record))
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
          <ManualDrinkForm onSave={saveRecord} />
          <RecentDrinkingRecords records={records} />
        </div>
      </div>
    </main>
  )
}
