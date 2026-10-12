import { useEffect, useState } from 'react'
import { AWARD_FEEDBACK_EVENT } from './awardFeedbackEvents'
import { applicationHref } from '../../app/entryPaths'
import { AwardMedal } from './AwardMedal'
import type { AwardPresentation } from './awardPresentation'
import './awards.css'

interface Notice { message: string; failed: boolean; awards: AwardPresentation[]; index: number }

function readNotice(detail: unknown): Notice | null {
  if (!detail || typeof detail !== 'object' || !('message' in detail) || typeof detail.message !== 'string'
    || !('failed' in detail) || typeof detail.failed !== 'boolean') return null
  const awards = !detail.failed && 'awards' in detail && Array.isArray(detail.awards)
    ? detail.awards.filter((value): value is AwardPresentation => {
      if (!value || typeof value !== 'object') return false
      const award = value as Partial<AwardPresentation>
      return typeof award.id === 'string' && typeof award.name === 'string' && award.status === 'earned'
        && typeof award.medal?.assetId === 'string' && award.medal.state === 'full-colour'
    }).sort((a, b) => Number(b.eligibility === 'limited-edition') - Number(a.eligibility === 'limited-edition'))
    : []
  return { message: detail.message, failed: detail.failed, awards, index: 0 }
}

/** One app-level notice at a time; committed unlocks survive route changes. */
export function AwardFeedback() {
  const [notices, setNotices] = useState<Notice[]>([])
  useEffect(() => {
    const receive = (event: Event) => {
      const notice = readNotice((event as CustomEvent).detail)
      if (notice) setNotices(current => notice.failed && current.some(item => item.failed && item.message === notice.message)
        ? current : [...current, notice])
    }
    window.addEventListener(AWARD_FEEDBACK_EVENT, receive)
    return () => window.removeEventListener(AWARD_FEEDBACK_EVENT, receive)
  }, [])

  const notice = notices[0]
  const award = notice?.awards[notice.index]
  const special = award?.eligibility === 'limited-edition'
  const hasNext = notice && notice.index < notice.awards.length - 1
  const dismiss = () => setNotices(current => current.slice(1))
  const next = () => setNotices(current => current.map((item, index) =>
    index === 0 ? { ...item, index: item.index + 1 } : item))

  return <div className="award-live-feedback" role="status" aria-live="polite" aria-atomic="true">
    {notice && <div className={`award-live-feedback-card${notice.failed ? ' award-live-feedback-card--error' : ''}${special ? ' award-live-feedback-card--special' : ''}`}>
      <button className="award-notice-dismiss" type="button" onClick={dismiss} aria-label="Dismiss award notification">×</button>
      {award ? <div className="award-notice-content">
        <AwardMedal award={award} size="notice" decorative />
        <div className="award-notice-copy">
          <p className="award-notice-title">{special ? 'A special award!' : 'Award earned!'}</p>
          <strong>{award.name}</strong>
          {special && <p className="award-notice-description">
            You've earned a special award for checking in. {award.significance}
          </p>}
          {notice.awards.length > 1 && <span className="award-notice-position">{notice.index + 1} of {notice.awards.length} new awards</span>}
        </div>
      </div> : <p className="award-notice-message">{notice.message}</p>}
      <div className="award-notice-actions">
        <a href={applicationHref('/awards')} onClick={event => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setNotices([])
        }}>View Awards</a>
        <button type="button" onClick={hasNext ? next : dismiss}>{hasNext ? 'Next award' : 'Dismiss'}</button>
      </div>
    </div>}
  </div>
}
