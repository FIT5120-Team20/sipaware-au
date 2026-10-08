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
  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  function save(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!isReminderTime(time)) { setError('Choose a valid reminder time.'); return }
    try {
      saveReminderPreference(time)
      setSaved(time)
      setError('')
      setMessage('Preferred time saved. Notifications are not enabled.')
    } catch { setError('Your time could not be saved. Please try again.'); }
  }
  function clear() {
    setMessage('')
    try {
      clearReminderPreference()
      setTime(''); setSaved(''); setError('')
      setMessage('Saved time removed. Notifications remain off.')
    } catch { setError('Your saved time could not be removed. Please try again.'); }
  }
  return <ReferenceDialog title="Recording reminder" onClose={onClose}>
    <div className="reminder-settings">
      <p><strong>Notifications are off.</strong> Background reminders are not available in this version. Saving a time does not schedule a notification.</p>
      {permission === 'unsupported' && <p>This browser does not support system notifications.</p>}
      {permission === 'denied' && <p>Notifications are blocked for this site in your browser settings.</p>}
      {permission === 'default' && <p>When reminders become available, we will explain notification access before asking for permission.</p>}
      {permission === 'granted' && <p>Browser permission is granted, but reminder delivery is not connected yet.</p>}
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
    </div>
  </ReferenceDialog>
}
export function ReminderSettings() {
  const [open, setOpen] = useState(false)
  return <div className="reminder-entry">
    <button type="button" onClick={() => setOpen(true)}>Recording reminder settings</button>
    {open && <SettingsDialog onClose={() => setOpen(false)} />}
  </div>
}
