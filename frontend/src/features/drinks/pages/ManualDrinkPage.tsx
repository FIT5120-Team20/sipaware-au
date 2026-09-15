/**
 * Feature orchestration boundary for manual capture, local history, and
 * browser-derived alcohol feedback.
 *
 * Child components create or edit domain objects, but only this page calls the
 * repositories. Keeping persistence here prevents UI controls from depending
 * directly on IndexedDB and keeps SavedDrink and DrinkingRecord state separate.
 */
import { applicationHref, applicationPath, RECORD_HOME_EVENT } from '../../../app/entryPaths'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getDrinkOptions } from '../../../services/drinkReferenceApi'
import { getAlcoholGuidelines } from '../../../services/guidelineReferenceApi'
import { calculateAlcoholConsumptionSummary } from '../calculations/alcoholConsumptionSummary'
import { ReferenceRecordResult } from '../components/ReferenceRecordResult'
import { AlcoholConsumptionSummary } from '../components/AlcoholConsumptionSummary'
import { DrivingSafetyGuidance } from '../components/DrivingSafetyGuidance'
import { ManualDrinkForm } from '../components/ManualDrinkForm'
import { ReferenceHistoryTrends } from '../components/ReferenceHistoryTrends'
import { mapDrinkReferenceCategories } from '../config/drinkTypes'
import { useCurrentLocalDateKey } from '../hooks/useCurrentLocalDateKey'
import { IndexedDbDrinkingRecordRepository } from '../storage/drinkingRecordRepository'
import { IndexedDbSavedDrinkRepository } from '../storage/savedDrinkRepository'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type {
  DrinkReferenceCategory,
  ReferenceLoadStatus,
} from '../types/drinkReference'
import type {
  AlcoholGuidelinesResponseDto,
  GuidelineLoadStatus,
} from '../types/alcoholGuideline'
import type { SavedDrink } from '../types/savedDrink'
import '../manualDrink.css'

type HydrationStatus = 'loading' | 'ready' | 'error'

export function ManualDrinkPage({ initialView = 'record' }: { initialView?: 'record' | 'history' }) {

  const [resultId, setResultId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('record'))
  const [templateFailed, setTemplateFailed] = useState(false)
  const [historyView, setHistoryView] = useState(initialView === 'history' || applicationPath() === '/trends')
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
  const [referenceCategories, setReferenceCategories] = useState<
    DrinkReferenceCategory[]
  >([])
  const [referenceStatus, setReferenceStatus] =
    useState<ReferenceLoadStatus>('loading')
  const [referenceLoadAttempt, setReferenceLoadAttempt] = useState(0)
  const [guidelines, setGuidelines] =
    useState<AlcoholGuidelinesResponseDto | null>(null)
  const [guidelineStatus, setGuidelineStatus] =
    useState<GuidelineLoadStatus>('loading')
  const [guidelineLoadAttempt, setGuidelineLoadAttempt] = useState(0)
  const currentLocalDateKey = useCurrentLocalDateKey()
  const consumptionSummary = useMemo(
    () => calculateAlcoholConsumptionSummary(records, currentLocalDateKey),
    [records, currentLocalDateKey],
  )

  const lastRecord = records.find(record => record.id === resultId)
  // A navigation hint identifies only a committed local snapshot; the record
  // itself is always read from IndexedDB, including after reload.
  const savedRecord = records.find(record => record.id === window.history.state?.savedRecordId)
  const savedTemplateFailed = window.history.state?.savedTemplateFailed === true

  // URLs identify only committed local records. Reload/back rehydrates the same
  // source of truth; it never repeats a write or fabricates a successful result.
  useEffect(() => {
  const restore = () => {
    setResultId(new URLSearchParams(window.location.search).get('record'))
    setHistoryView(applicationPath() === '/trends')
  }
  const returnToRecordHome = () => {
    setResultId(null)
    setTemplateFailed(false)
  }

  window.addEventListener('popstate', restore)
  window.addEventListener(RECORD_HOME_EVENT, returnToRecordHome)

  return () => {
    window.removeEventListener('popstate', restore)
    window.removeEventListener(RECORD_HOME_EVENT, returnToRecordHome)
  }
}, [])
  
  useEffect(() => {
    const heading = document.getElementById('record-result-title')
    if (resultId && heading) { heading.focus(); heading.scrollIntoView?.({ block: 'start' }) }
  }, [resultId, hydrationStatus])
  function showRecordedHistory(record: DrinkingRecord, failed: boolean) {
    // The form calls this only after the record and optional template writes
    // settle. The shared route event updates the sidebar and selects History.
    window.history.pushState({ savedRecordId: record.id, savedTemplateFailed: failed }, '', applicationHref('/trends#history'))
    setResultId(null)
    setHistoryView(true)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  function returnToBrowse() {
    window.history.pushState({}, '', applicationHref('/record'))
    setResultId(null)
    setTemplateFailed(false)
  }

  // IndexedDB reads are asynchronous. The feature stays in a loading state
  // until both independent stores have hydrated, avoiding an empty-state flash
  // that could be mistaken for lost browser data.
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

  // Public reference loading is independent from IndexedDB hydration. A Neon
  // outage therefore cannot erase, rewrite or block reading personal history.
  useEffect(() => {
    const abortController = new AbortController()
    let isActive = true

    async function loadReferenceData() {
      try {
        const response = await getDrinkOptions(abortController.signal)
        const categories = mapDrinkReferenceCategories(response)
        if (isActive) {
          setReferenceCategories(categories)
          setReferenceStatus('loaded')
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        if (isActive) {
          setReferenceCategories([])
          setReferenceStatus('failed')
        }
      }
    }

    void loadReferenceData()
    return () => {
      isActive = false
      abortController.abort()
    }
  }, [referenceLoadAttempt])

  // Guideline reference loading is independent from both the drink-option API
  // and IndexedDB. A failure cannot block recording or alter personal history.
  useEffect(() => {
    const abortController = new AbortController()
    let isActive = true

    async function loadGuidelines() {
      try {
        const response = await getAlcoholGuidelines(abortController.signal)
        if (isActive) {
          setGuidelines(response)
          setGuidelineStatus('loaded')
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        if (isActive) {
          setGuidelines(null)
          setGuidelineStatus('failed')
        }
      }
    }

    void loadGuidelines()
    return () => {
      isActive = false
      abortController.abort()
    }
  }, [guidelineLoadAttempt])

  function retryReferenceData() {
    setReferenceCategories([])
    setReferenceStatus('loading')
    setReferenceLoadAttempt((currentAttempt) => currentAttempt + 1)
  }

  function retryGuidelines() {
    setGuidelines(null)
    setGuidelineStatus('loading')
    setGuidelineLoadAttempt((currentAttempt) => currentAttempt + 1)
  }

  // Every write returns the repository's complete committed collection. React
  // replaces its state from that result so the screen mirrors IndexedDB after
  // add, correction, or deletion rather than guessing the mutation succeeded.
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

  // SavedDrink operations update only the reusable-template collection. They
  // never rewrite the historical DrinkingRecord snapshots already in history.
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
    <div className="manual-drink-page">
      <main className="manual-drink-shell">
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
          (initialView === 'history' || historyView) ? (
            <>
            <ReferenceHistoryTrends records={records} initialRecordId={savedRecord?.id} referenceCategories={referenceCategories}
              onUpdate={updateRecord} onDelete={deleteRecord} guidelines={guidelines} guidelineStatus={guidelineStatus}
              onRetryGuidelines={retryGuidelines} todayKey={currentLocalDateKey} />
            {savedRecord && <section className="manual-drink-card reference-history-summary">
              <p role={savedTemplateFailed ? 'alert' : 'status'}>{savedTemplateFailed
                ? 'Drinking record saved on this device, but the drink could not be saved to My Drinks. Do not record the same occasion again.'
                : 'Drinking record saved on this device.'}</p>
              <AlcoholConsumptionSummary presentation="reference" summary={consumptionSummary} guidelines={guidelines}
                guidelineStatus={guidelineStatus} onRetryGuidelines={retryGuidelines} showRelatedInformation={false} />
              {consumptionSummary.hasEligibleDrinkingRecordToday && <DrivingSafetyGuidance />}
            </section>}
            </>
          ) : resultId ? (
            lastRecord ? <ReferenceRecordResult record={lastRecord} templateFailed={templateFailed} onDone={returnToBrowse}>
              <AlcoholConsumptionSummary presentation="reference" summary={consumptionSummary} guidelines={guidelines}
                guidelineStatus={guidelineStatus} onRetryGuidelines={retryGuidelines} showRelatedInformation={false} />
              {consumptionSummary.hasEligibleDrinkingRecordToday && <DrivingSafetyGuidance />}
            </ReferenceRecordResult> : <section className="reference-record-result">
              <h1>Record unavailable</h1><p>This record is no longer available on this device.</p>
              <button type="button" className="primary-button" onClick={returnToBrowse}>Back to Record</button>
            </section>
          ) : <ManualDrinkForm
            startInBrowse
            referenceCategories={referenceCategories}
            referenceStatus={referenceStatus}
            onRetryReferenceData={retryReferenceData}
            savedDrinks={savedDrinks}
            onSave={saveRecord}
            onRecorded={showRecordedHistory}
            onSaveSavedDrink={saveDrinkForFutureUse}
            onUpdateSavedDrink={updateSavedDrink}
            onDeleteSavedDrink={deleteSavedDrink}
          />
        )}
      </main>

    </div>
  )
}
