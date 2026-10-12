import { useId, useRef, useState } from 'react'
import { ReferenceDialog } from '../drinks/components/ReferenceDialog'
import { ReminderSuggestionPrompt } from './ReminderSuggestionPrompt'
import { isReminderTime } from './reminderPreference'
import {
  checkRecordingReminderService, disableRecordingReminder, enableRecordingReminder,
  refreshRecordingReminder, reminderPresentation, selectedReminderTime,
  updateRecordingReminderTime, useRecordingReminder,
} from './recordingReminderState'
import { nextReminderLabel } from './nextReminder'
import './reminderSettings.css'

function NotificationPermissionStatus({ id }: {
  id: string
}) {
  return <section className="recording-reminder-permission" role="status" aria-labelledby={id + '-title'}>
    <h3 id={id + '-title'}>Notifications are blocked</h3>
    <p id={id + '-description'}>Allow SipAware notifications in your browser or device settings, then return here.</p>
  </section>
}

function ReminderSetupDialog({ busy, error, timeError, permissionBlocked, onConfirm, onClose }: {
  busy: boolean
  error: string
  timeError: boolean
  permissionBlocked: boolean
  onConfirm: (time: string) => Promise<void>
  onClose: () => void
}) {
  const id = useId()
  const [time, setTime] = useState('')
  const [guidance, setGuidance] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const invalid = Boolean(time && guidance) || (submitted && timeError && Boolean(error))
  const failure = submitted ? error : ''

  return <ReferenceDialog title="Set your reminder" className="reminder-setup-dialog"
    descriptionId={id + '-description'} onClose={() => { if (!busy) onClose() }}>
    <p id={id + '-description'}>Choose when you'd like SipAware to remind you to check in each day.</p>
    <form className="reminder-setup-form" noValidate onSubmit={event => {
      event.preventDefault()
      if (busy) return
      if (!isReminderTime(time)) {
        setSubmitted(false)
        setGuidance(time ? 'Please choose a valid reminder time.' : 'Choose a reminder time to continue.')
        return
      }
      setGuidance('')
      setSubmitted(true)
      void onConfirm(time)
    }}>
      <label htmlFor={id + '-time'}>Reminder time</label>
      <input id={id + '-time'} type="time" step={60} required value={time} disabled={busy}
        aria-invalid={invalid || undefined}
        aria-describedby={[id + '-help', guidance && id + '-guidance', failure && id + '-error', permissionBlocked && id + '-permission-description'].filter(Boolean).join(' ')}
        onChange={event => { setTime(event.target.value); setGuidance(''); setSubmitted(false) }} />
      <p id={id + '-help'}>You can change this time later in Reminder settings.</p>
      {guidance && <p id={id + '-guidance'} className={invalid ? 'recording-reminder-error' : 'recording-reminder-guidance'}
        role={invalid ? 'alert' : 'status'}>{guidance}</p>}
      {failure && <p id={id + '-error'} className="recording-reminder-error" role="alert">{failure}</p>}
      {permissionBlocked && <NotificationPermissionStatus id={id + '-permission'} />}
      <div className="reminder-setup-actions">
        <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Enabling…' : 'Enable reminder'}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </form>
  </ReferenceDialog>
}

/** One settings surface, backed by the existing acknowledged push operations. */
export function ReminderSettings() {
  const reminder = useRecordingReminder()
  const presentation = reminderPresentation(reminder)
  const time = selectedReminderTime(reminder)
  const [draftTime, setDraftTime] = useState<string | null>(null)
  const [editingTime, setEditingTime] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [message, setMessage] = useState('')
  const toggleButton = useRef<HTMLButtonElement>(null)
  const id = useId()
  const busy = reminder.pending !== null
  const initializing = !reminder.verified && reminder.checking
  const enabled = reminder.status?.enabled === true
  const canEnable = reminder.support.available && reminder.service !== 'unavailable' && reminder.service !== 'checking'
  const disabled = busy || !reminder.verified || (!enabled && !canEnable)
  const unavailable = !enabled && (!reminder.support.available || reminder.service === 'unavailable')
  const label = presentation.label === 'Off' && unavailable ? 'Unavailable' : presentation.label
  const reminderError = !setupOpen && reminder.errorTarget === 'reminder' ? reminder.error : ''
  const timeError = !setupOpen && reminder.errorTarget === 'time' ? reminder.error : ''
  const permissionBlocked = reminder.support.permission === 'denied' && (enabled || reminder.permissionIssue)
  const showPermission = permissionBlocked && !setupOpen
  const supportMessage = reminder.support.permission !== 'denied' && !setupOpen && reminder.support.message !== reminderError
    ? reminder.support.message : ''

  function toggle() {
    if (disabled || setupOpen) return
    setMessage('')
    if (enabled) void disableRecordingReminder()
    else if (reminder.support.permission === 'denied') void enableRecordingReminder(time)
    else if (isReminderTime(time)) void enableRecordingReminder(time)
    else {
      // Safari does not focus buttons on a pointer click. Capture the actual
      // initiating control so the native dialog can return focus on dismissal.
      toggleButton.current?.focus({ preventScroll: true })
      setSetupOpen(true)
    }
  }
  async function confirmSetup(value: string) {
    if (await enableRecordingReminder(value)) setSetupOpen(false)
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

  return <div className="reminder-settings recording-reminder-settings" aria-busy={busy || initializing}>
    {initializing ? <div className="recording-reminder-loading" role="status">
      <span className="recording-reminder-loading-copy">Loading reminder settings…</span>
      <div className="recording-reminder-card recording-reminder-placeholder" aria-hidden="true">
        <span /><span /><span />
      </div>
      <div className="recording-reminder-card recording-reminder-placeholder recording-reminder-placeholder--time" aria-hidden="true">
        <span /><span />
      </div>
    </div> : <>
      <section className="recording-reminder-card" aria-labelledby={id + '-daily'}>
        <div className="recording-reminder-toggle-row">
          <div className="recording-reminder-copy">
            <h2 id={id + '-daily'}>Daily reminder</h2>
            <p id={id + '-description'}>Remind me to check in each day</p>
          </div>
          <button ref={toggleButton} type="button" role="switch" className="recording-reminder-switch"
            aria-checked={enabled} aria-labelledby={id + '-daily'}
            aria-describedby={[id + '-description', id + '-status', reminderError && id + '-error', supportMessage && id + '-support', showPermission && id + '-permission-description'].filter(Boolean).join(' ')}
            disabled={disabled} onClick={toggle}>
            <span className="recording-reminder-switch-track" aria-hidden="true"><span /></span>
          </button>
        </div>
        <p id={id + '-status'} className="recording-reminder-status" role="status">
          <span className={'recording-reminder-status-label' + (label === 'On' ? ' recording-reminder-status-label--on' : '')}>{label}</span>
          {reminder.pending === 'disable' ? 'Turning off…'
            : reminder.pending === 'time' ? 'Updating time…'
            : presentation.ringing ? presentation.subtitle
            : reminder.status?.needs_attention && !permissionBlocked ? 'Turn on Daily reminder to restore your reminder.' : ''}
        </p>
        {reminder.verified && presentation.ringing && !busy && reminder.status &&
          <p role="status">{nextReminderLabel(reminder.status)}</p>}
        {showPermission && <NotificationPermissionStatus id={id + '-permission'} />}
        {supportMessage && <p id={id + '-support'} className="recording-reminder-guidance">{supportMessage}</p>}
        {reminder.service === 'unavailable' &&
          <p className="recording-reminder-guidance">The reminder service is temporarily unavailable. Check your connection and retry.</p>}
        {reminderError && <p id={id + '-error'} className="recording-reminder-error" role="alert">{reminderError}</p>}
        {!reminder.verified && <p className="recording-reminder-guidance">{reminder.status
          ? 'Your current reminder status could not be confirmed. Your last confirmed setting is shown.'
          : 'Your reminder status could not be confirmed. Check your connection and retry.'}</p>}
        {(!reminder.verified || reminder.service === 'unavailable' || reminderError || (presentation.label === 'Needs attention' && !permissionBlocked)) &&
          <button type="button" className="secondary-button recording-reminder-retry"
            disabled={busy || reminder.checking || reminder.service === 'checking'} onClick={retry}>Retry reminder status</button>}
      </section>

      <section className="recording-reminder-card recording-reminder-time-card" aria-label="Reminder time settings">
        <div className="recording-reminder-time-row">
          <label htmlFor={id + '-time'}>Reminder time</label>
          <input id={id + '-time'} type="time" step={60} value={draftTime ?? time}
            disabled={busy || !reminder.verified} aria-invalid={Boolean(timeError) || undefined}
            aria-describedby={[id + '-time-help', timeError && id + '-time-error', reminder.preferenceError && id + '-preference-error'].filter(Boolean).join(' ')}
            onFocus={() => setEditingTime(true)} onChange={event => setDraftTime(event.target.value)}
            onBlur={event => { void confirmTime(event.currentTarget.value) }}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} />
        </div>
        <p id={id + '-time-help'}>{enabled ? 'Changing the time sets a new reminder, even if one was sent today. Changes apply when you finish choosing a time.' : 'Choose a time to use when you turn on Daily reminder.'}</p>
        {timeError && <p id={id + '-time-error'} className="recording-reminder-error" role="alert">{timeError}</p>}
        {reminder.preferenceError && <p id={id + '-preference-error'} className="recording-reminder-error" role="alert">{reminder.preferenceError}</p>}
      </section>
    </>}
    {message && <p role="status" className="recording-reminder-message">{message}</p>}
    <ReminderSuggestionPrompt currentTime={draftTime ?? time} busy={busy || reminder.checking || !reminder.verified || setupOpen}
      canPrompt={!editingTime && !busy && !reminder.checking && reminder.verified && !setupOpen}
      onApplyTime={updateRecordingReminderTime} />
    {setupOpen && <ReminderSetupDialog busy={busy} error={reminder.error} timeError={reminder.errorTarget === 'time'}
      permissionBlocked={permissionBlocked}
      onConfirm={confirmSetup} onClose={() => setSetupOpen(false)} />}
  </div>
}
