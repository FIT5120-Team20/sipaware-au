/** Home settings reuse ReferenceDialog. Local preferred time is independent of
 * server delivery: saving a preference must never claim push has been enabled. */
import { PushSettingsControl } from './PushSettingsControl'
import { NotificationPermissionControl } from './NotificationPermissionControl'
import { ReminderSuggestionPrompt } from './ReminderSuggestionPrompt'
import { useState } from 'react'
import { ReferenceDialog } from '../drinks/components/ReferenceDialog'
import { clearReminderPreference, isReminderTime, readReminderPreference, saveReminderPreference } from './reminderPreference'
import './reminderSettings.css'

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [initial] = useState(() => {
    try { return { time: readReminderPreference()?.time ?? '', failed: false } }
    catch { return { time: '', failed: true } }
  })
  const [time, setTime] = useState(initial.time)
  const [saved, setSaved] = useState(initial.time)
  const [error, setError] = useState(initial.failed ? 'Your saved time could not be read. You can try saving a new preference.' : '')
  const [message, setMessage] = useState('')
  function save(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!isReminderTime(time)) { setError('Choose a valid reminder time.'); return }
    try {
      saveReminderPreference(time)
      setSaved(time)
      setError('')
      setMessage('Preferred time saved. Background reminder settings are unchanged.')
    } catch { setError('Your time could not be saved. Please try again.'); }
  }
  function clear() {
    setMessage('')
    try {
      clearReminderPreference()
      setTime(''); setSaved(''); setError('')
      setMessage('Saved time removed. Background reminder settings are unchanged.')
    } catch { setError('Your saved time could not be removed. Please try again.'); }
  }
  return <ReferenceDialog title="Recording reminder" onClose={onClose}>
    <div className="reminder-settings">
      <p>Saving a preferred time does not enable or change a background reminder. Use the background reminder controls to apply it.</p>
      <NotificationPermissionControl />
      <form onSubmit={save} noValidate>
        <label htmlFor="reminder-time">Preferred daily reminder time</label>
        <input id="reminder-time" type="time" value={time} onChange={event => { setTime(event.target.value); setMessage('') }} />
        <p>This is a time preference for this browser. No drinking records are created.</p>
        {saved && <p>Saved time: {saved}</p>}
        {error && <p role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <div className="reminder-settings-actions">
          <button type="submit">Save preferred time</button>
          {(saved || initial.failed) && <button type="button" onClick={clear}>Remove saved time</button>}
          <button type="button" onClick={onClose}>Close</button>
        </div>
      </form>
      <PushSettingsControl time={time} />
    </div>
  </ReferenceDialog>
}
export function ReminderSettings() {
  const [open, setOpen] = useState(false)
  return <div className="reminder-entry">
    <button type="button" onClick={() => setOpen(true)}>Recording reminder settings</button>
    <ReminderSuggestionPrompt onChooseTime={() => setOpen(true)} />
    {open && <SettingsDialog onClose={() => setOpen(false)} />}
  </div>
}
