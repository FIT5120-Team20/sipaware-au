import { useEffect, useId, useState } from 'react'
import { ReminderSuggestionPrompt } from './ReminderSuggestionPrompt'
import {
  checkRecordingReminderService, disableRecordingReminder, enableRecordingReminder,
  refreshRecordingReminder, reminderPresentation, selectedReminderTime,
  updateRecordingReminderTime, useRecordingReminder,
} from './recordingReminderState'
import './reminderSettings.css'

/** One settings surface, backed by the existing acknowledged push operations. */
export function ReminderSettings() {
  const reminder = useRecordingReminder()
  const presentation = reminderPresentation(reminder)
  const time = selectedReminderTime(reminder)
  const [draftTime, setDraftTime] = useState<string | null>(null)
  const [editingTime, setEditingTime] = useState(false)
  const [message, setMessage] = useState('')
  const id = useId()
  const busy = reminder.pending !== null
  const enabled = reminder.status?.enabled === true
  const canEnable = reminder.support.available && reminder.support.permission !== 'denied' && reminder.service === 'available'
  const disabled = busy || reminder.checking || !reminder.verified || (!enabled && !canEnable)
  const unavailable = !enabled && (!reminder.support.available || reminder.service === 'unavailable')
  const label = presentation.label === 'Off' && unavailable ? 'Unavailable' : presentation.label

  useEffect(() => { void checkRecordingReminderService() }, [])

  function toggle() {
    setMessage('')
    if (enabled) void disableRecordingReminder()
    else void enableRecordingReminder(time)
  }
  async function confirmTime(value: string) {
    setEditingTime(false)
    setDraftTime(null)
    setMessage('')
    if (value !== time && await updateRecordingReminderTime(value)) {
      setMessage(enabled ? 'Reminder time updated.' : 'Reminder time saved.')
    }
  }
  function retry() {
    void refreshRecordingReminder()
    void checkRecordingReminderService()
  }

  return <div className="reminder-settings recording-reminder-settings" aria-busy={busy}>
    <section className="recording-reminder-card" aria-labelledby={id + '-daily'}>
      <div className="recording-reminder-toggle-row">
        <div className="recording-reminder-copy">
          <h2 id={id + '-daily'}>Daily reminder</h2>
          <p id={id + '-description'}>Remind me to check in each day</p>
        </div>
        <button type="button" role="switch" className="recording-reminder-switch"
          aria-checked={enabled} aria-labelledby={id + '-daily'}
          aria-describedby={id + '-description ' + id + '-status'}
          disabled={disabled} onClick={toggle}>
          <span className="recording-reminder-switch-track" aria-hidden="true"><span /></span>
        </button>
      </div>
      <p id={id + '-status'} className="recording-reminder-status" role="status">
        <span className={'recording-reminder-status-label' + (label === 'On' ? ' recording-reminder-status-label--on' : '')}>
          {!reminder.verified && reminder.checking ? 'Checking reminder…' : label}
        </span>
        {reminder.pending === 'disable' ? 'Turning off…'
          : reminder.pending === 'time' ? 'Updating time…'
          : presentation.ringing ? presentation.subtitle
          : reminder.service === 'checking' && reminder.support.available ? 'Checking reminder availability…'
          : reminder.status?.needs_attention ? 'Turn on Daily reminder to restore your reminder.' : ''}
      </p>
    </section>

    <section className="recording-reminder-card recording-reminder-time-card" aria-label="Reminder time settings">
      <div className="recording-reminder-time-row">
        <label htmlFor={id + '-time'}>Reminder time</label>
        <input id={id + '-time'} type="time" step={60} value={draftTime ?? time}
          disabled={busy} aria-describedby={id + '-time-help'}
          onFocus={() => setEditingTime(true)} onChange={event => setDraftTime(event.target.value)}
          onBlur={event => { void confirmTime(event.currentTarget.value) }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} />
      </div>
      <p id={id + '-time-help'}>{enabled ? 'Changes apply when you finish choosing a time.' : 'Choose a time to use when you turn on Daily reminder.'}</p>
    </section>

    {reminder.support.message && <p className="recording-reminder-guidance">{reminder.support.message}</p>}
    {reminder.service === 'unavailable' && <p className="recording-reminder-guidance">The reminder service is temporarily unavailable. Check your connection and retry.</p>}
    {reminder.error && <p className="recording-reminder-error" role="alert">{reminder.error}</p>}
    {reminder.preferenceError && <p className="recording-reminder-error" role="alert">{reminder.preferenceError}</p>}
    {!reminder.verified && !reminder.checking && <p className="recording-reminder-guidance">Your current reminder status could not be confirmed. Your last confirmed setting is shown.</p>}
    {(!reminder.verified || reminder.service === 'unavailable' || reminder.error || presentation.label === 'Needs attention') &&
      <button type="button" className="secondary-button recording-reminder-retry" disabled={busy || reminder.checking || reminder.service === 'checking'} onClick={retry}>Retry reminder status</button>}
    {message && <p role="status" className="recording-reminder-message">{message}</p>}

    <ReminderSuggestionPrompt currentTime={draftTime ?? time} busy={busy || reminder.checking || !reminder.verified}
      canPrompt={!editingTime && !busy && !reminder.checking && reminder.verified}
      onApplyTime={updateRecordingReminderTime} />
  </div>
}
