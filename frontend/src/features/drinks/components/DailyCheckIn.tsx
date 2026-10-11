/** Approved Record check-in presentation.
 * These controls request actions; only the page/repository can persist a day.
 * Decorative logos never replace the readable, keyboard-accessible choices. */
import { useEffect, useId, useRef, useState } from 'react'
import { ConsumptionDateTimeFields } from './ConsumptionDateTimeFields'
import { ReferenceDialog } from './ReferenceDialog'
import { SipAwareIcon } from './SipAwareIcon'
import { isCalendarDate } from '../types/dailyCheckIn'
import type { ConsumptionDateTimeErrors, ConsumptionDateTimeValues } from '../types/manualDrinkForm'
import { getCurrentLocalCalendarDateKey } from '../utils/localCalendarDate'
import { validateConsumptionDate, validateConsumptionDateTime } from '../validation/drinkingRecordValidation'
import '../dailyCheckIn.css'

export function CheckInLogo({ kind }: { kind: 'zero' | 'drink' }) {
  return <svg className="check-in-logo" viewBox="0 0 220 200" aria-hidden="true" focusable="false">
    {kind === 'zero' ? <>
      <circle cx="106" cy="97" r="84" fill="#dceee8" />
      <ellipse cx="106" cy="170" rx="57" ry="7" fill="#28605c" opacity=".09" />
      <path d="M69 77c0-23 15-39 35-39s35 16 35 39v38c0 23-15 39-35 39s-35-16-35-39V77Z" fill="#fff" stroke="#28605c" strokeWidth="5" />
      <path d="M90 77c0-13 5-20 14-20s14 7 14 20v38c0 13-5 20-14 20s-14-7-14-20V77Z" fill="#eaf4f0" />
      <path d="M127 76c-3-27 16-42 48-43 0 26-16 45-42 43Z" fill="#8fc0ad" stroke="#28605c" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="m120 92 36-41" fill="none" stroke="#28605c" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="154" cy="140" r="24" fill="#fff" stroke="#28605c" strokeWidth="3" />
      <path d="m144 140 7 7 13-15" fill="none" stroke="#28605c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="37" cy="100" r="4" fill="#8fc0ad" /><path d="M50 46v12m-6-6h12" stroke="#6da38e" strokeWidth="2.5" strokeLinecap="round" />
    </> : <>
      <circle cx="112" cy="97" r="84" fill="#dde8fb" />
      <ellipse cx="112" cy="170" rx="57" ry="7" fill="#1a5fcc" opacity=".09" />
      <path d="M69 41h68l-5 48c-2 17-14 28-29 28S76 106 74 89l-5-48Z" fill="#fff" stroke="#1a5fcc" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M76 77c16-9 32 9 56 0l-1 11c-2 16-13 27-28 27S78 104 76 88V77Z" fill="#96b6ee" />
      <path d="M103 118v36m-21 2h42" stroke="#1a5fcc" strokeWidth="4.5" strokeLinecap="round" />
      <path d="m141 137 32-48a7 7 0 0 1 12 8l-32 48-17 11 5-19Z" fill="#fff" stroke="#1a5fcc" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="m169 95 12 8m-40 34 12 8m-17 11 5-19" fill="none" stroke="#1a5fcc" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M47 73h13m-13 10h9M153 39v12m-6-6h12" stroke="#7799d0" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="186" cy="129" r="4" fill="#96b6ee" />
    </>}
  </svg>
}

type Props = {
  dateTime: ConsumptionDateTimeValues
  onDateTimeChange: (field: keyof ConsumptionDateTimeValues, value: string) => void
  hasDrinks?: boolean
  onNoAlcohol: (date: string) => Promise<void>
  onViewRecords: (date: string) => void
  onDrink: (dateTime: ConsumptionDateTimeValues) => void
}

export function DailyCheckIn({ dateTime, onDateTimeChange, hasDrinks = false, onNoAlcohol, onViewRecords, onDrink }: Props) {
  const pickerId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictDate, setConflictDate] = useState<string | null>(null)
  const [futureDateNotice, setFutureDateNotice] = useState(false)
  const [dateTimeErrors, setDateTimeErrors] = useState<ConsumptionDateTimeErrors>({})
  const pending = useRef(false)
  const lastValidDate = useRef(validateConsumptionDate(dateTime.date) ? getCurrentLocalCalendarDateKey() : dateTime.date)
  const pendingFutureDateNotice = useRef(false)
  const futureDateNoticeTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!validateConsumptionDate(dateTime.date)) lastValidDate.current = dateTime.date
  }, [dateTime.date])
  useEffect(() => () => {
    if (futureDateNoticeTimer.current !== null) window.clearTimeout(futureDateNoticeTimer.current)
  }, [])

  function isFutureDate(date: string) {
    return isCalendarDate(date) && date > getCurrentLocalCalendarDateKey()
  }
  function scheduleFutureDateNotice() {
    if (!pendingFutureDateNotice.current) return
    if (futureDateNoticeTimer.current !== null) window.clearTimeout(futureDateNoticeTimer.current)
    // Wait for native picker dismissal; never move focus away from an active picker.
    futureDateNoticeTimer.current = window.setTimeout(() => {
      futureDateNoticeTimer.current = null
      const activeId = document.activeElement?.id
      if (!pendingFutureDateNotice.current || activeId === `${pickerId}-date` || activeId === `${pickerId}-time`) return
      setFutureDateNotice(true)
    }, 300)
  }
  function rejectFutureDate() {
    const validDate = !validateConsumptionDate(dateTime.date) ? dateTime.date
      : !validateConsumptionDate(lastValidDate.current) ? lastValidDate.current : getCurrentLocalCalendarDateKey()
    lastValidDate.current = validDate
    if (dateTime.date !== validDate) onDateTimeChange('date', validDate)
    setDateTimeErrors(current => ({ ...current, date: undefined }))
    pendingFutureDateNotice.current = true
    scheduleFutureDateNotice()
  }
  function dismissFutureDateNotice() {
    pendingFutureDateNotice.current = false
    setFutureDateNotice(false)
  }
  function validateSelection(includeTime: boolean) {
    if (isFutureDate(dateTime.date)) { rejectFutureDate(); return false }
    if (pendingFutureDateNotice.current) { scheduleFutureDateNotice(); return false }
    const dateError = validateConsumptionDate(dateTime.date)
    const errors: ConsumptionDateTimeErrors = includeTime ? validateConsumptionDateTime(dateTime) : dateError ? { date: dateError } : {}
    setDateTimeErrors(errors)
    const firstInvalidField = errors.date ? 'date' : errors.time ? 'time' : null
    if (firstInvalidField) document.getElementById(`${pickerId}-${firstInvalidField}`)?.focus()
    return !firstInvalidField
  }
  async function saveZero() {
    if (pending.current) return
    setError(null)
    // Alcohol-free confirmations have a calendar date, never a consumed time.
    if (!validateSelection(false)) return
    const selectedDate = dateTime.date
    if (hasDrinks) { setConflictDate(selectedDate); return }
    pending.current = true
    setBusy(true); setError(null)
    try { await onNoAlcohol(selectedDate) }
    catch (cause) {
      if (cause instanceof Error && cause.message === 'This day already has drinking records. Review them in History before marking it alcohol-free.') {
        setConflictDate(selectedDate)
      } else {
        setError('This day could not be saved as alcohol-free. Check for existing drinking records in History, or try again. Nothing has been overwritten.')
      }
    }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="daily-check-in" aria-label="Record daily check-in" onBlur={event => {
    if (event.target.id === `${pickerId}-date` || event.target.id === `${pickerId}-time`) scheduleFutureDateNotice()
  }}>
    <header className="reference-page-heading"><h1>Record</h1></header>
    <ConsumptionDateTimeFields idPrefix={pickerId} values={dateTime} errors={dateTimeErrors}
      legend="When are you recording for?" disabled={busy} onChange={(field, value) => {
        setDateTimeErrors({}); setError(null)
        if (field === 'date' && isFutureDate(value)) { rejectFutureDate(); return }
        if (field === 'date' && !validateConsumptionDate(value)) lastValidDate.current = value
        onDateTimeChange(field, value)
      }} />
    <div className="check-in-choices" aria-busy={busy}>
      <article className="check-in-choice check-in-choice--zero" aria-labelledby={`${pickerId}-zero-title`}>
        <CheckInLogo kind="zero" />
        <h2 className="check-in-title" id={`${pickerId}-zero-title`}>No alcohol</h2>
        <p className="check-in-copy">Save this day as alcohol-free.</p>
        <button type="button" className="check-in-cta" disabled={busy} onClick={() => void saveZero()}>
          {busy ? 'Saving…' : 'Save & view history'}
        </button>
      </article>
      <article className="check-in-choice check-in-choice--drink" aria-labelledby={`${pickerId}-drink-title`}>
        <CheckInLogo kind="drink" />
        <h2 className="check-in-title" id={`${pickerId}-drink-title`}>I drank</h2>
        <p className="check-in-copy">Record what you drank.</p>
        <button type="button" className="check-in-cta" disabled={busy} onClick={() => {
          setError(null)
          if (validateSelection(true)) onDrink(dateTime)
        }}>
          Continue
        </button>
      </article>
    </div>
    {error && <p className="check-in-error" role="alert">{error}</p>}
    {futureDateNotice && <ReferenceDialog title="Future dates aren't available" onClose={dismissFutureDateNotice}>
      <p>You can only record drinks for today or an earlier date.</p>
      <button type="button" className="primary-button" onClick={dismissFutureDateNotice}>Got it</button>
    </ReferenceDialog>}
    {conflictDate && <ReferenceDialog title="Drinks already recorded" onClose={() => setConflictDate(null)}>
      <p className="check-in-conflict-message"><SipAwareIcon name="about" width="24" height="24" />
        <span>This date already has drinking records, so it can't be marked alcohol-free.</span>
      </p>
      <p>Review or correct these records in History.</p>
      <div className="reference-dialog-actions check-in-conflict-actions">
        <button type="button" onClick={() => setConflictDate(null)}>Close</button>
        <button type="button" onClick={() => {
          const date = conflictDate
          if (!date) return
          setConflictDate(null)
          onViewRecords(date)
        }}>View records</button>
      </div>
    </ReferenceDialog>}
  </section>
}
