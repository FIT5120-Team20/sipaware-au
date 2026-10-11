import { useEffect, useState } from 'react'
import { openSipAwareDatabase, DRINKING_RECORDS_STORE_NAME } from '../drinks/storage/indexedDb'
import { openCheckInDatabase, withDailyDataLock } from '../drinks/storage/dailyCheckInDatabase'
import { readReminderPreference, saveReminderPreference } from './reminderPreference'
import { suggestReminder, type ReminderSuggestion } from './reminderSuggestion'

export function ReminderSuggestionPrompt({ onChooseTime, onSaved }: { onChooseTime: () => void; onSaved?: (time: string) => void }) {
  const [suggestion, setSuggestion] = useState<ReminderSuggestion | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    withDailyDataLock(async () => {
      const records = await (await openSipAwareDatabase()).getAll(DRINKING_RECORDS_STORE_NAME)
      const checkIns = await (await openCheckInDatabase()).getAll('daily_checkins')
      const result = suggestReminder(records, checkIns)
      const saved = readReminderPreference()
      if (active && result?.time !== saved?.time) setSuggestion(result)
    }).catch(() => { /* No reliable history means no personalised suggestion. */ })
    return () => { active = false }
  }, [])
  function accept() {
    if (!suggestion) return
    try {
      saveReminderPreference(suggestion.time)
      onSaved?.(suggestion.time)
      setSuggestion(null)
      setMessage('Suggested time saved. Notifications are still off; background delivery is not available yet.')
    } catch { setError('The suggested time could not be saved. Your previous preference has not been changed.') }
  }
  return <>
    {suggestion && <section className="reminder-settings" aria-label="Suggested reminder time">
      <h3>A time that may suit you</h3>
      <p>Your first check-ins on {suggestion.matchingDays} of {suggestion.totalDays} days fall within a two-hour window. Based on those check-ins, try {suggestion.time}.</p>
      <p>This saves a preferred time only. Notifications remain off.</p>
      {error && <p role="alert">{error}</p>}
      <div className="reminder-settings-actions">
        <button type="button" onClick={accept}>Save suggested time {suggestion.time}</button>
        <button type="button" onClick={() => { setSuggestion(null); onChooseTime() }}>Choose another time</button>
        <button type="button" onClick={() => setSuggestion(null)}>Keep current settings</button>
      </div>
    </section>}
    {message && <p role="status">{message}</p>}
  </>
}
