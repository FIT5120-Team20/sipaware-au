import { useEffect, useState } from 'react'
import { AWARD_FEEDBACK_EVENT } from './awardFeedbackEvents'
import { applicationHref } from '../../app/entryPaths'
import './awards.css'

/** App-level feedback survives Record -> History route changes. */
export function AwardFeedback() {
  const [notice, setNotice] = useState<{ message: string; failed: boolean } | null>(null)
  useEffect(() => {
    const receive = (event: Event) => {
      const detail: unknown = (event as CustomEvent).detail
      if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string'
        && 'failed' in detail && typeof detail.failed === 'boolean') {
        setNotice({ message: detail.message, failed: detail.failed })
      }
    }
    window.addEventListener(AWARD_FEEDBACK_EVENT, receive)
    return () => window.removeEventListener(AWARD_FEEDBACK_EVENT, receive)
  }, [])
  return <div className="award-live-feedback" aria-live="polite" aria-atomic="true">
    {notice && <div className={notice.failed ? 'award-live-feedback-card award-live-feedback-card--error' : 'award-live-feedback-card'}>
      <p>{notice.message}</p>
      <div><a href={applicationHref('/awards')}>View Awards</a>
        <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss award notification">Dismiss</button></div>
    </div>}
  </div>
}
