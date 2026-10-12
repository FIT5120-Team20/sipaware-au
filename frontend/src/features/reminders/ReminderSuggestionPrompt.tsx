import { useEffect, useState } from 'react'
import { openSipAwareDatabase, DRINKING_RECORDS_STORE_NAME } from '../drinks/storage/indexedDb'
import { openCheckInDatabase, withDailyDataLock } from '../drinks/storage/dailyCheckInDatabase'
import { ReferenceDialog } from '../drinks/components/ReferenceDialog'
import { isReminderTime, readReminderPreference, saveReminderPreference } from './reminderPreference'
import { suggestReminder, type ReminderSuggestion } from './reminderSuggestion'
import { formatReminderTime } from './formatReminderTime'

const PRESENTED_KEY = 'sipaware.reminder-suggestion-presented.v1'
function materiallyDifferent(time: string, previous: string) {
  const minutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
  const difference = Math.abs(minutes(time) - minutes(previous))
  return Math.min(difference, 1440 - difference) >= 30
}
function presentedTime() {
  try {
    const previous = localStorage.getItem(PRESENTED_KEY)
    return previous === null || isReminderTime(previous) ? previous : 'unavailable'
  } catch { return 'unavailable' }
}
interface SuggestionPromptProps {
  currentTime?: string
  busy?: boolean
  canPrompt?: boolean
  onApplyTime?: (time: string) => Promise<boolean>
  onChooseTime?: () => void
  onSaved?: (time: string) => void
}

/** Uses the existing recommendation algorithm and committed history unchanged. */
export function ReminderSuggestionPrompt({ currentTime, busy = false, canPrompt = true, onApplyTime, onSaved }: SuggestionPromptProps) {
  const [suggestion, setSuggestion] = useState<ReminderSuggestion | null>(null)
  const [presented, setPresented] = useState(presentedTime)
  const [sheet, setSheet] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const selectedTime = currentTime ?? (() => { try { return readReminderPreference()?.time ?? '' } catch { return '' } })()
  const pending = busy || applying
  const candidate = suggestion && suggestion.time !== selectedTime ? suggestion : null

  useEffect(() => {
    let active = true
    const load = () => {
      void withDailyDataLock(async () => {
        const records = await (await openSipAwareDatabase()).getAll(DRINKING_RECORDS_STORE_NAME)
        const checkIns = await (await openCheckInDatabase()).getAll('daily_checkins')
        const result = suggestReminder(records, checkIns)
        if (active) setSuggestion(result)
      }).catch(() => { if (active) setSuggestion(null) })
    }
    load()
    window.addEventListener('sipaware:history-committed', load)
    return () => { active = false; window.removeEventListener('sipaware:history-committed', load) }
  }, [])

  useEffect(() => {
    if (!canPrompt || pending || !candidate || presented === 'unavailable'
      || (presented !== null && !materiallyDifferent(candidate.time, presented))) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        // Remember presentation after the page commits. Dismissal and reload
        // cannot repeat this prompt; the inline suggestion remains available.
        localStorage.setItem(PRESENTED_KEY, candidate.time)
        setPresented(candidate.time)
        setSheet(true)
      } catch { setPresented('unavailable') }
    })
    return () => { active = false }
  }, [canPrompt, pending, candidate, presented])

  async function accept() {
    if (!candidate || pending) return
    setApplying(true); setError(''); setMessage('')
    try {
      const applied = onApplyTime ? await onApplyTime(candidate.time) : (() => { saveReminderPreference(candidate.time); return true })()
      if (!applied) { setError('The suggested time could not be confirmed. Check the reminder status and try again.'); return }
      onSaved?.(candidate.time)
      setSheet(false)
      setMessage('Reminder time updated.')
    } catch { setError('The suggested time could not be saved. Your current setting has been kept.') }
    finally { setApplying(false) }
  }
  function keepTime() { setSheet(false); setError('') }
  const formatted = candidate ? formatReminderTime(candidate.time, '24-hour') : ''
  return <>
    {candidate && <section className="recording-reminder-card recording-reminder-suggestion" aria-labelledby="reminder-suggestion-title">
      <h2 id="reminder-suggestion-title">Suggested reminder time</h2>
      <p>Based on your check-in patterns, {formatted} may be a convenient time for your daily reminder.</p>
      <button type="button" className="secondary-button" disabled={pending} onClick={() => { void accept() }}>{applying ? 'Applying…' : `Use ${formatted}`}</button>
      {error && !sheet && <p role="alert">{error}</p>}
    </section>}
    {sheet && candidate && <ReferenceDialog title="We found a time that may suit you" onClose={keepTime}>
      <p>Based on when you usually check in, {formatted} may be a convenient time for your daily reminder.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" className="primary-button" disabled={pending} onClick={() => { void accept() }}>{applying ? 'Applying…' : `Use ${formatted}`}</button>
      <button type="button" className="secondary-button recording-reminder-sheet-secondary" disabled={applying} onClick={keepTime}>Keep my current time</button>
    </ReferenceDialog>}
    {message && <p role="status" className="recording-reminder-message">{message}</p>}
  </>
}
