/**
 * Feature orchestration boundary for manual capture, local history, and
 * browser-derived alcohol feedback.
 *
 * Child components create or edit domain objects, but only this page calls the
 * repositories. Keeping persistence here prevents UI controls from depending
 * directly on IndexedDB and keeps SavedDrink and DrinkingRecord state separate.
 */
import { updateAwardsAfterCheckIn } from '../../awards/awardFeedbackEvents'
import { applicationHref, applicationPath, RECORD_HOME_EVENT } from '../../../app/entryPaths'
import { prepareNavigationScroll, requestNavigationScroll } from '../../../app/navigationScroll'
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
import type { ConsumptionDateTimeValues } from '../types/manualDrinkForm'
import { DailyCheckIn } from '../components/DailyCheckIn'
import { IndexedDbDailyCheckInRepository } from '../storage/dailyCheckInRepository'
import { isCalendarDate, type DailyCheckInState } from '../types/dailyCheckIn'
import { getCurrentLocalCalendarDateKey, getRecordLocalCalendarDateKey } from '../utils/localCalendarDate'
import { getCurrentLocalDateTimeInputValues } from '../utils/formatConsumedDateTime'
import '../manualDrink.css'

// The URL carries only a validated date, never an uncommitted personal record.
function readCaptureDate() {
  const date = new URLSearchParams(window.location.search).get('date')
  return isCalendarDate(date) && date <= getCurrentLocalCalendarDateKey() ? date : null
}

type RecordFlow = {
  dateTime: ConsumptionDateTimeValues
  step: 'check-in' | 'drinks'
}

function readRecordFlow(): RecordFlow {
  const date = readCaptureDate()
  const stored = window.history.state?.recordDateTime
  if (date !== null && stored?.date === date && typeof stored.time === 'string') {
    return {
      dateTime: { date, time: stored.time },
      step: window.history.state?.recordStep === 'drinks' ? 'drinks' : 'check-in',
    }
  }
  const currentDateTime = getCurrentLocalDateTimeInputValues()
  return {
    dateTime: { ...currentDateTime, date: date ?? currentDateTime.date },
    step: 'check-in',
  }
}

type HydrationStatus = 'loading' | 'ready' | 'error'

export function ManualDrinkPage({ initialView = 'record' }: { initialView?: 'record' | 'history' }) {
  const returningToCheckIn = useRef(false)
  const [recordFlow, setRecordFlow] = useState<RecordFlow>(readRecordFlow)
  const [historyDate, setHistoryDate] = useState<string | undefined>(() => window.history.state?.checkInDate)
  const [checkIns, setCheckIns] = useState<DailyCheckInState>({ alcoholFreeDates: [] })
  const checkInRepository = useMemo(() => new IndexedDbDailyCheckInRepository(), [])
  const [resultId, setResultId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('record'))
  const [templateFailed, setTemplateFailed] = useState(
    () => window.history.state?.savedTemplateFailed === true,
  )
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

  // Draft date/time navigation state never writes a personal record. Result IDs
  // still identify only committed snapshots, so reload/back cannot repeat a save.
  useEffect(() => {
    const restore = () => {
      const flow = readRecordFlow()
      const returnToTop = returningToCheckIn.current && applicationPath() === '/record' && flow.step === 'check-in'
      returningToCheckIn.current = false
      setRecordFlow(flow)
      setHistoryDate(window.history.state?.checkInDate)
      setResultId(new URLSearchParams(window.location.search).get('record'))
      setTemplateFailed(window.history.state?.savedTemplateFailed === true)
      setHistoryView(applicationPath() === '/trends')
      if (returnToTop) requestNavigationScroll({ kind: 'top' })
    }
    const returnToRecordHome = () => {
      setRecordFlow({ dateTime: getCurrentLocalDateTimeInputValues(), step: 'check-in' })
      setHistoryView(false)
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

  // Route state selects the exact History month/date. Saved hints mark committed
  // data only; opening History never replays a write.
  function showHistory(date: string, record?: DrinkingRecord, failed = false, saved = true, revealDetails = saved) {
    prepareNavigationScroll()
    window.history.pushState({ checkInDate: date, checkInSaved: saved, savedRecordId: record?.id, savedTemplateFailed: failed,
      revealHistoryDetails: revealDetails ? date : undefined }, '', applicationHref('/trends#history'))
    setHistoryDate(date); setHistoryView(true)
    setResultId(null); setTemplateFailed(failed)
    window.dispatchEvent(new PopStateEvent('popstate'))
    requestNavigationScroll({ kind: 'preserve' })
  }
  function showRecordedResult(record: DrinkingRecord, failed: boolean) {
    if (!isMounted.current) return
    prepareNavigationScroll()
    // Only a committed record can open the result. Its ID lets reload recover
    // the same local snapshot without submitting the form a second time.
    window.history.pushState({ savedTemplateFailed: failed }, '', applicationHref('/record?record=' + encodeURIComponent(record.id)))
    setHistoryView(false)
    setResultId(record.id); setTemplateFailed(failed)
    window.dispatchEvent(new PopStateEvent('popstate'))
    requestNavigationScroll({ kind: 'top' })
  }
  function startRecordForDate(date: string) {
    prepareNavigationScroll()
    window.history.replaceState({ ...window.history.state, checkInDate: date, checkInSaved: false, savedRecordId: undefined }, '')
    const dateTime = { ...getCurrentLocalDateTimeInputValues(), date }
    window.history.pushState({ fromHistory: true, recordDateTime: dateTime, recordStep: 'check-in' }, '', applicationHref('/record?date=' + date))
    setRecordFlow({ dateTime, step: 'check-in' }); setHistoryView(false); setResultId(null)
    window.dispatchEvent(new PopStateEvent('popstate'))
    requestNavigationScroll({ kind: 'top' })
  }
  function updateRecordDateTime(field: keyof ConsumptionDateTimeValues, value: string) {
    const dateTime = { ...recordFlow.dateTime, [field]: value }
    setRecordFlow({ dateTime, step: 'check-in' })
    window.history.replaceState({ ...window.history.state, recordDateTime: dateTime, recordStep: 'check-in' }, '', applicationHref('/record?date=' + encodeURIComponent(dateTime.date)))
  }
  function startDrinking(dateTime: ConsumptionDateTimeValues) {
    prepareNavigationScroll()
    const selectionState = { ...window.history.state, recordDateTime: dateTime, recordStep: 'check-in', fromCheckIn: false }
    const href = applicationHref('/record?date=' + encodeURIComponent(dateTime.date))
    // Keep the chosen occasion in both entries so Back restores the first screen.
    window.history.replaceState(selectionState, '', href)
    window.history.pushState({ ...selectionState, recordStep: 'drinks', fromCheckIn: true }, '', href)
    setRecordFlow({ dateTime, step: 'drinks' }); setHistoryView(false); setResultId(null)
    window.dispatchEvent(new PopStateEvent('popstate'))
    requestNavigationScroll({ kind: 'top' })
  }
  async function confirmAlcoholFree(date: string) {
    await checkInRepository.confirmAlcoholFree(date)
    await updateAwardsAfterCheckIn()
    if (isMounted.current) {
      setCheckIns(current => ({ ...current, alcoholFreeDates: [...new Set([...current.alcoholFreeDates, date])] }))
      showHistory(date)
    }
  }
  function continueToHistory() {
    // A backfilled drink belongs to its consumed date, not today's page.
    if (lastRecord) showHistory(getRecordLocalCalendarDateKey(lastRecord), lastRecord, templateFailed)
  }
  function returnToBrowse(preserveSelection = false) {
    prepareNavigationScroll()
    const dateTime = preserveSelection ? recordFlow.dateTime : getCurrentLocalDateTimeInputValues()
    setRecordFlow({ dateTime, step: 'check-in' })
    window.history.pushState({ fromHistory: preserveSelection && window.history.state?.fromHistory === true, recordDateTime: dateTime, recordStep: 'check-in' }, '', applicationHref('/record?date=' + encodeURIComponent(dateTime.date)))
    setResultId(null)
    setTemplateFailed(false)
    requestNavigationScroll({ kind: 'top' })
  }

  function returnToCheckIn() {
    prepareNavigationScroll()
    if (window.history.state?.fromCheckIn === true) {
      // The preceding entry is the check-in with this same selected occasion.
      returningToCheckIn.current = true
      window.history.back()
      return
    }
    // Older browser entries may lack the navigation marker. Replace that entry
    // so Back cannot reopen an abandoned drink browser or reset the occasion.
    const dateTime = recordFlow.dateTime
    window.history.replaceState({ ...window.history.state, recordDateTime: dateTime, recordStep: 'check-in', fromCheckIn: false }, '', applicationHref('/record?date=' + encodeURIComponent(dateTime.date)))
    setRecordFlow({ dateTime, step: 'check-in' })
    setHistoryView(false)
    setResultId(null)
    setTemplateFailed(false)
    window.dispatchEvent(new PopStateEvent('popstate'))
    requestNavigationScroll({ kind: 'top' })
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
        const [storedRecords, storedSavedDrinks, storedCheckIns] = await Promise.all([
          drinkingRecordRepository.list(),
          savedDrinkRepository.list(),
          checkInRepository.initialize(),
        ])

        if (isMounted.current) {
          setRecords(storedRecords)
          setSavedDrinks(storedSavedDrinks)
          setCheckIns(storedCheckIns)
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
  }, [drinkingRecordRepository, savedDrinkRepository, checkInRepository])

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
      setCheckIns(current => ({ ...current, alcoholFreeDates: current.alcoholFreeDates.filter(date => date !== getRecordLocalCalendarDateKey(record)) }))
    }
    await updateAwardsAfterCheckIn()
  }

  async function updateRecord(record: DrinkingRecord): Promise<void> {
    const persistedRecords = await drinkingRecordRepository.update(record)
    if (isMounted.current) {
      setRecords(persistedRecords)
      setCheckIns(current => ({ ...current, alcoholFreeDates: current.alcoholFreeDates.filter(date => date !== getRecordLocalCalendarDateKey(record)) }))
    }
    await updateAwardsAfterCheckIn()
  }

  async function deleteRecord(recordId: string): Promise<void> {
    const persistedRecords = await drinkingRecordRepository.delete(recordId)
    if (isMounted.current) {
      setRecords(persistedRecords)
    }
    await updateAwardsAfterCheckIn()
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
    <div className="manual-drink-page" data-navigation-scroll-ready={hydrationStatus !== 'loading'}>
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
              to try again. If another SipAware tab is open, close it before reloading. Nothing has been changed.
            </div>
          </section>
        )}

        {hydrationStatus === 'ready' && (
          historyView ? (
            <>
            {templateFailed && <p className="check-in-error check-in-save-feedback" role="alert">Drinking record saved on this device, but the drink could not be saved to My Drinks. Do not record the same occasion again.</p>}
            <ReferenceHistoryTrends
              records={records}
              initialRecordId={savedRecord?.id}
              initialDateKey={historyDate}
              savedDay={window.history.state?.checkInSaved === true}
              alcoholFreeDates={checkIns.alcoholFreeDates}
              onRecordDate={startRecordForDate}
              referenceCategories={referenceCategories}
              onUpdate={updateRecord}
              onDelete={deleteRecord}
              guidelines={guidelines}
              guidelineStatus={guidelineStatus}
              onRetryGuidelines={retryGuidelines}
              todayKey={currentLocalDateKey}
            />
            {savedRecord && <details className="check-in-save-feedback">
              <summary>Drink saved · View summary{consumptionSummary.hasEligibleDrinkingRecordToday ? ' · Avoid drinking and driving' : ''}</summary>
              <AlcoholConsumptionSummary presentation="reference" summary={consumptionSummary} guidelines={guidelines}
                guidelineStatus={guidelineStatus} onRetryGuidelines={retryGuidelines} showRelatedInformation={false} />
              {consumptionSummary.hasEligibleDrinkingRecordToday && <DrivingSafetyGuidance />}
            </details>}
            </>
          ) : resultId ? (
            lastRecord ? <ReferenceRecordResult record={lastRecord} templateFailed={templateFailed} onDone={continueToHistory}>
              <AlcoholConsumptionSummary presentation="reference" summary={consumptionSummary} guidelines={guidelines}
                guidelineStatus={guidelineStatus} onRetryGuidelines={retryGuidelines} showRelatedInformation={false} />
              {consumptionSummary.hasEligibleDrinkingRecordToday && <DrivingSafetyGuidance />}
            </ReferenceRecordResult> : <section className="reference-record-result">
              <h1>Record unavailable</h1><p>This record is no longer available on this device.</p>
              <button type="button" className="primary-button" onClick={() => returnToBrowse()}>Back to Record</button>
            </section>
          ) : recordFlow.step === 'check-in' ? <DailyCheckIn dateTime={recordFlow.dateTime}
            onDateTimeChange={updateRecordDateTime}
            hasDrinks={records.some(record => getRecordLocalCalendarDateKey(record) === recordFlow.dateTime.date)}
            onViewRecords={date => showHistory(date, undefined, false, false, true)}
            onNoAlcohol={confirmAlcoholFree} onDrink={startDrinking} /> : <>
            <ManualDrinkForm
            key={`${recordFlow.dateTime.date}T${recordFlow.dateTime.time}`}
            selectedDateTime={recordFlow.dateTime}
            onBackToCheckIn={returnToCheckIn}
            startInBrowse
            referenceCategories={referenceCategories}
            referenceStatus={referenceStatus}
            onRetryReferenceData={retryReferenceData}
            savedDrinks={savedDrinks}
            onSave={saveRecord}
            onRecorded={showRecordedResult}
            onSaveSavedDrink={saveDrinkForFutureUse}
            onUpdateSavedDrink={updateSavedDrink}
            onDeleteSavedDrink={deleteSavedDrink}
          /></>
        )}
      </main>

    </div>
  )
}
