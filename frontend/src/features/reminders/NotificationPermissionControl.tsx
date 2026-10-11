import { useEffect, useRef, useState } from 'react'

export type NotificationAccess = 'unsupported' | 'insecure' | NotificationPermission
function notificationAccess(): NotificationAccess {
  if (!window.isSecureContext) return 'insecure'
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  return Notification.permission
}

/** Permission is a prerequisite only; it never enables or schedules a reminder. */
export function NotificationPermissionControl() {
  const [access, setAccess] = useState(notificationAccess)
  const [explaining, setExplaining] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  useEffect(() => {
    const refresh = () => setAccess(notificationAccess())
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible) }
  }, [])
  async function requestAccess() {
    if (pending.current) return
    const current = notificationAccess()
    if (current !== 'default') { setAccess(current); setExplaining(false); return }
    pending.current = true; setBusy(true); setError('')
    try { setAccess(await Notification.requestPermission()); setExplaining(false) }
    catch { setError('Notification permission could not be requested. Please try again.'); setAccess(notificationAccess()) }
    finally { pending.current = false; setBusy(false) }
  }
  return <section aria-label="Browser notification permission">
    <p aria-live="polite" data-testid="notification-access">{access === 'insecure' ? 'Notifications require a secure HTTPS connection or a supported local development address.'
      : access === 'unsupported' ? 'This browser does not support all required notification features. On supported iPhones or iPads, try adding the site to your Home Screen and opening it there.'
      : access === 'denied' ? 'Notifications are blocked. To allow them, change this site’s notification permission in your browser settings, then return here.'
      : access === 'granted' ? 'Browser permission is granted. Use the background reminder controls to enable or check delivery.'
      : 'Browser notification permission has not been granted.'}</p>
    {access === 'default' && !explaining && <button type="button" onClick={() => setExplaining(true)}>Set up notification permission</button>}
    {access === 'default' && explaining && <div>
      <p>SipAware needs permission to show a daily check-in notification outside this page. You can decline. Granting permission alone does not turn on reminders, send a notification or create a drinking record.</p>
      <button type="button" disabled={busy} onClick={() => void requestAccess()}>{busy ? 'Waiting for browser…' : 'Continue to browser permission'}</button>
      <button type="button" disabled={busy} onClick={() => setExplaining(false)}>Not now</button>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>
}
