/** Shared presentation of acknowledged push settings; preferences never prove activation. */
import { useEffect, useSyncExternalStore } from 'react'
import { disablePush, enablePush, PUSH_CHANGED, pushCapabilities, pushStatus, type PushStatus } from './pushClient'
import { isReminderTime, readReminderPreference, saveReminderPreference, REMINDER_PREFERENCE_KEY } from './reminderPreference'
import { formatReminderTime, type ReminderTimeFormat } from './formatReminderTime'

export { formatReminderTime } from './formatReminderTime'

type PendingOperation = 'enable' | 'disable' | 'time' | null
type ReminderSupport = { available: boolean; permission: NotificationPermission | null; message: string }
interface RecordingReminderState {
  status: PushStatus | null
  verified: boolean
  checking: boolean
  pending: PendingOperation
  preferredTime: string
  preferenceError: string
  error: string
  errorTarget: 'reminder' | 'time'
  permissionIssue: boolean
  service: 'unknown' | 'checking' | 'available' | 'unavailable'
  support: ReminderSupport
}

function browserSupport(): ReminderSupport {
  const unavailable = (message: string): ReminderSupport => ({ available: false, permission: null, message })
  if (!window.isSecureContext) return unavailable('Daily reminders need a secure HTTPS connection.')
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (ios && !installed) return unavailable('On iPhone or iPad, add SipAware to your Home Screen, open it there, then turn on Daily reminder.')
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator) || !navigator.locks) {
    return unavailable('This browser does not support daily notifications. Try a supported browser or device.')
  }
  return {
    available: true,
    permission: Notification.permission,
    message: Notification.permission === 'denied' ? 'Notifications are blocked. Allow SipAware notifications in your browser or device settings, then return here.' : '',
  }
}

let state: RecordingReminderState = {
  status: null, verified: false, checking: true, pending: null,
  preferredTime: '', preferenceError: '', error: '', errorTarget: 'reminder', permissionIssue: false, service: 'unknown', support: browserSupport(),
}
const listeners = new Set<() => void>()
let generation = 0
let reading: Promise<void> | null = null
let checkingService: Promise<void> | null = null
function publish(update: Partial<RecordingReminderState>) {
  state = { ...state, ...update }
  listeners.forEach(listener => listener())
}
function validateStatus(status: PushStatus): PushStatus {
  if (typeof status?.enabled !== 'boolean' || typeof status.saved !== 'boolean'
    || (status.enabled && (!isReminderTime(status.time ?? '') || !status.timezone))) {
    throw new Error('The reminder status could not be verified. Please retry.')
  }
  return status
}
function loadPreference() {
  try { return { preferredTime: readReminderPreference()?.time ?? '', preferenceError: '' } }
  catch { return { preferredTime: state.preferredTime, preferenceError: 'Your saved time could not be read. Choose a time to replace it.' } }
}

export function refreshRecordingReminder(): Promise<void> {
  if (state.pending) return Promise.resolve()
  if (reading) return reading
  const current = generation
  const support = browserSupport()
  publish({ ...loadPreference(), support, checking: true,
    permissionIssue: support.permission === 'denied' && state.permissionIssue })
  const request = pushStatus().then(result => {
    const status = validateStatus(result)
    if (current === generation) publish({ status, verified: true, checking: false })
  }).catch(() => {
    if (current === generation) publish({ verified: false, checking: false })
  }).finally(() => { if (reading === request) reading = null })
  reading = request
  return request
}

export function checkRecordingReminderService(): Promise<void> {
  if (checkingService) return checkingService
  publish({ service: 'checking' })
  const request = pushCapabilities().then(config => {
    publish({ service: config.available && config.publicKey ? 'available' : 'unavailable' })
  }).catch(() => { publish({ service: 'unavailable' }) })
    .finally(() => { if (checkingService === request) checkingService = null })
  checkingService = request
  return request
}

function refresh() { void refreshRecordingReminder() }
function settingsChanged() {
  if (state.pending) return
  generation++
  reading = null
  refresh()
}
function visible() { if (document.visibilityState === 'visible') refresh() }
function storage(event: StorageEvent) {
  if (event.key === null || event.key === REMINDER_PREFERENCE_KEY || event.key.startsWith('sipaware.push.')) settingsChanged()
}
function subscribe(listener: () => void) {
  if (!listeners.size) {
    window.addEventListener(PUSH_CHANGED, settingsChanged)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('storage', storage)
    document.addEventListener('visibilitychange', visible)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      window.removeEventListener(PUSH_CHANGED, settingsChanged)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('storage', storage)
      document.removeEventListener('visibilitychange', visible)
    }
  }
}
const getSnapshot = () => state
export function useRecordingReminder() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => { void refreshRecordingReminder() }, [])
  return snapshot
}

export function selectedReminderTime(snapshot = state) {
  if (snapshot.status?.enabled && isReminderTime(snapshot.status.time ?? '')) return snapshot.status.time!
  return snapshot.preferredTime || (isReminderTime(snapshot.status?.time ?? '') ? snapshot.status!.time! : '')
}
export function reminderPresentation(snapshot: RecordingReminderState, timeFormat: ReminderTimeFormat = '12-hour') {
  const unavailable = { label: 'Unavailable', subtitle: 'Reminder status unavailable', ringing: false }
  if (snapshot.pending === 'enable') return { label: 'Setting up', subtitle: 'Setting up reminder', ringing: false }
  if (snapshot.checking && !snapshot.verified) return { label: 'Checking', subtitle: 'Checking reminder status', ringing: false }
  if (!snapshot.verified || !snapshot.status) return unavailable
  if ((snapshot.status.enabled || snapshot.status.needs_attention) && (!snapshot.support.available || snapshot.support.permission !== 'granted')) {
    return { label: 'Needs attention', subtitle: 'Review notification settings', ringing: false }
  }
  if (snapshot.status.needs_attention && snapshot.status.attention_reason === 'scheduling') {
    return { label: 'Updating', subtitle: 'Your reminder schedule is updating automatically.', ringing: false }
  }
  if (snapshot.status.needs_attention) {
    return { label: 'Needs attention', subtitle: 'Reminder needs attention', ringing: false }
  }
  if (snapshot.status.enabled) return { label: 'On', subtitle: `Daily at ${formatReminderTime(snapshot.status.time!, timeFormat)}`, ringing: true }
  return { label: 'Off', subtitle: 'Set a time for your daily check-in', ringing: false }
}

/** The Home entry is a summary; settings provide actionable status feedback. */
export function homeReminderPresentation(snapshot: RecordingReminderState, timeFormat: ReminderTimeFormat = '12-hour') {
  const presentation = reminderPresentation(snapshot, timeFormat)
  return {
    subtitle: presentation.ringing ? presentation.subtitle : 'Set a time for your daily check-in',
    ringing: presentation.ringing,
  }
}

function begin(pending: PendingOperation) {
  generation++ // Late status reads cannot overwrite an acknowledged mutation.
  reading = null
  publish({ pending, checking: false, error: '', errorTarget: pending === 'time' ? 'time' : 'reminder', support: browserSupport() })
}
function rememberTime(time: string) {
  try {
    saveReminderPreference(time)
    publish({ preferredTime: time, preferenceError: '' })
    return true
  } catch {
    publish({ preferenceError: 'Your time could not be saved on this device. Please try again.' })
    return false
  }
}
async function reconcileFailure(message: string): Promise<PushStatus | null> {
  try {
    const status = validateStatus(await pushStatus())
    publish({ status, verified: true, error: message })
    return status
  } catch {
    // A failed response may still have committed. Retain the last known schedule,
    // but do not present it as verified until the existing status API answers.
    publish({ verified: false, error: `${message} The current reminder status could not be confirmed. Retry when your connection is available.` })
    return null
  }
}

function confirmsTime(status: PushStatus | null, time: string) {
  return status?.enabled === true && !status.needs_attention && status.time === time
    && status.timezone === Intl.DateTimeFormat().resolvedOptions().timeZone
}

function activationFailure(error: unknown) {
  if ((error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError'))
    || (error instanceof TypeError && /fetch|network|load/i.test(error.message))) {
    return "We couldn't reach the reminder service. Check your connection and try again."
  }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return "We couldn't save your reminder settings. Free up website storage on this device, then try again."
  }
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return "We couldn't set up your reminder. Check that notifications and website storage are allowed, then try again."
  }
  if (error instanceof Error && error.message === 'Background delivery is not configured yet.') {
    return 'Recording reminders are temporarily unavailable. Please try again later.'
  }
  return error instanceof Error ? error.message : 'Your reminder could not be turned on. Check your connection and try again.'
}

export async function enableRecordingReminder(time: string): Promise<boolean> {
  if (state.pending) return false
  const support = browserSupport()
  if (support.permission === 'denied') {
    // Permission status has its own contextual presentation. Do not copy it
    // into the operation error or erase a genuinely different failure.
    publish({ support, permissionIssue: true }); return false
  }
  if (!support.available) {
    publish({ support, error: support.message, errorTarget: 'reminder' }); return false
  }
  if (!isReminderTime(time)) { publish({ error: 'Please choose a valid reminder time.', errorTarget: 'time' }); return false }
  if (!state.verified) {
    publish({ error: 'Reminder status is unavailable. Retry before turning on your reminder.', errorTarget: 'reminder' }); return false
  }
  begin('enable')
  let attempted = false
  try {
    // Called directly by the switch or setup confirmation, before any network await.
    const permission = support.permission === 'default' ? await Notification.requestPermission() : support.permission
    publish({ support: browserSupport(), permissionIssue: permission === 'denied' })
    if (permission !== 'granted') {
      if (permission !== 'denied') publish({ error: 'Notifications were not allowed. Your reminder has not been turned on.' })
      return false
    }
    attempted = true
    const status = validateStatus(await enablePush(time))
    if (!status.enabled || status.needs_attention || status.time !== time || status.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone) {
      throw new Error('The requested schedule was not confirmed. Your current reminder setting has been kept.')
    }
    publish({ status, verified: true, service: 'available' })
    rememberTime(time)
    return true
  } catch (error) {
    const support = browserSupport()
    const denied = support.permission === 'denied'
    publish({ support, permissionIssue: denied })
    if (denied && ((!attempted && error instanceof DOMException && error.name === 'NotAllowedError')
      || (error instanceof Error && error.message === 'Grant browser notification permission first.'))) return false
    const message = activationFailure(error)
    if (attempted) {
      const status = await reconcileFailure(message)
      if (confirmsTime(status, time)) {
        publish({ error: '', service: 'available' })
        rememberTime(time)
        return true
      }
    } else publish({ error: message, support: browserSupport() })
    return false
  } finally { publish({ pending: null }) }
}

export async function disableRecordingReminder(): Promise<boolean> {
  if (state.pending || !state.verified || !state.status) return false
  const time = selectedReminderTime()
  begin('disable')
  try {
    const status = validateStatus(await disablePush())
    publish({ status, verified: true })
    if (isReminderTime(time)) rememberTime(time)
    return true
  } catch (error) {
    const status = await reconcileFailure(error instanceof Error ? error.message : 'Your reminder could not be turned off. Please try again.')
    if (status && !status.enabled && !status.needs_attention) {
      publish({ error: '' })
      if (isReminderTime(time)) rememberTime(time)
      return true
    }
    return false
  } finally { publish({ pending: null }) }
}

export async function updateRecordingReminderTime(time: string): Promise<boolean> {
  if (state.pending) return false
  if (!isReminderTime(time)) { publish({ error: 'Please choose a valid reminder time.', errorTarget: 'time' }); return false }
  if (!state.verified || !state.status) {
    publish({ error: 'Check your reminder status before changing its time. Your previous time has been kept.', errorTarget: 'time' }); return false
  }
  if (!state.status.enabled) {
    publish({ error: '' })
    return rememberTime(time)
  }
  if (time === state.status.time) return true
  const support = browserSupport()
  if (support.permission === 'denied') {
    publish({ support, permissionIssue: true }); return false
  }
  if (!support.available || support.permission !== 'granted') {
    publish({ support, error: support.message || 'Allow notifications before updating your active reminder.', errorTarget: 'time' }); return false
  }
  begin('time')
  try {
    const status = validateStatus(await enablePush(time))
    if (!status.enabled || status.needs_attention || status.time !== time || status.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone) {
      throw new Error('The new time was not confirmed. Your current reminder setting has been kept.')
    }
    publish({ status, verified: true })
    rememberTime(time)
    return true
  } catch (error) {
    const support = browserSupport()
    publish({ support, permissionIssue: support.permission === 'denied' })
    if (support.permission === 'denied' && error instanceof Error && error.message === 'Grant browser notification permission first.') return false
    const status = await reconcileFailure(activationFailure(error))
    if (confirmsTime(status, time)) {
      publish({ error: '' })
      rememberTime(time)
      return true
    }
    return false
  } finally { publish({ pending: null }) }
}
