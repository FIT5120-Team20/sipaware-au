import { useEffect, useId, useLayoutEffect, useRef, useState, type AnimationEvent } from 'react'
import { AWARD_FEEDBACK_EVENT } from './awardFeedbackEvents'
import { applicationHref } from '../../app/entryPaths'
import { AwardMedal } from './AwardMedal'
import { awardDetailDescription } from './awardDisplay'
import { openAwardDetail } from './useAwardsNavigation'
import type { AwardPresentation } from './awardPresentation'
import './awards.css'

interface Notice { message: string; failed: boolean; awards: AwardPresentation[] }
interface QueuedNotice extends Notice { id: number }

function readNotice(detail: unknown): Notice | null {
  if (!detail || typeof detail !== 'object' || !('message' in detail) || typeof detail.message !== 'string'
    || !('failed' in detail) || typeof detail.failed !== 'boolean') return null
  const ids = new Set<string>()
  const awards = !detail.failed && 'awards' in detail && Array.isArray(detail.awards)
    ? detail.awards.filter((value): value is AwardPresentation => {
      if (!value || typeof value !== 'object') return false
      const award = value as Partial<AwardPresentation>
      if (typeof award.id !== 'string' || typeof award.name !== 'string' || award.status !== 'earned'
        || typeof award.medal?.assetId !== 'string' || award.medal.state !== 'full-colour' || ids.has(award.id)) return false
      ids.add(award.id)
      return true
    }).sort((a, b) => Number(b.eligibility === 'limited-edition') - Number(a.eligibility === 'limited-edition'))
    : []
  return { message: detail.message, failed: detail.failed, awards }
}

/** Native modal semantics match the existing dialogs; one committed batch stays together. */
function AwardCelebration({ awards, onContinue }: { awards: AwardPresentation[]; onContinue: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const restoreFocus = useRef(true)
  const id = useId()
  const [detailsVisible, setDetailsVisible] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [selectedId, setSelectedId] = useState(awards[0].id)
  const selected = awards.find(award => award.id === selectedId) ?? awards[0]
  const multiple = awards.length > 1

  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    const previousFocus = document.activeElement
    element.showModal()
    element.focus({ preventScroll: true })
    return () => {
      if (element.open) element.close()
      if (restoreFocus.current && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true })
      }
    }
  }, [])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const skipEntrance = () => { if (motion.matches) setDetailsVisible(true) }
    motion.addEventListener('change', skipEntrance)
    return () => motion.removeEventListener('change', skipEntrance)
  }, [])

  function revealDetails(event: AnimationEvent<HTMLDivElement>) {
    // The artwork finishes first; no timers or repeated animations are needed.
    if (event.target === event.currentTarget && event.animationName === 'award-celebration-badge') setDetailsVisible(true)
  }

  function viewAward() {
    restoreFocus.current = false
    // Release the native modal and its scroll lock before requesting navigation.
    dialog.current?.close()
    onContinue()
    openAwardDetail(selected.category, selected.id)
  }

  return <dialog ref={dialog} className={`award-celebration-dialog${detailsVisible ? ' award-celebration-dialog--revealed' : ''}`}
    aria-labelledby={id + '-title'}
    aria-describedby={id + '-name ' + id + '-description' + (selected.significance ? ' ' + id + '-significance' : '')}
    onCancel={event => { event.preventDefault(); onContinue() }}>
    <div className="award-celebration-content">
      <h2 id={id + '-title'}>{multiple ? 'Awards earned!' : 'Award earned!'}</h2>
      {multiple ? <fieldset className="award-celebration-choices" disabled={!detailsVisible} aria-hidden={!detailsVisible}>
        <legend className="award-celebration-sr-only">Choose an award to view</legend>
        <div className="award-celebration-grid" onAnimationEnd={revealDetails}>
          {awards.map(award => <label key={award.id} className="award-celebration-choice">
            <input type="radio" name={id + '-award'} value={award.id} checked={selected.id === award.id}
              onChange={() => setSelectedId(award.id)} />
            <AwardMedal award={award} size="notice" decorative />
            <span>{award.name}</span>
          </label>)}
        </div>
      </fieldset> : <div className="award-celebration-artwork" onAnimationEnd={revealDetails}>
        <AwardMedal award={selected} size="detail" decorative />
      </div>}
      <div className="award-celebration-copy" aria-live={multiple ? 'polite' : undefined} aria-atomic="true">
        <h3 id={id + '-name'}>{selected.name}</h3>
        <p id={id + '-description'}>{awardDetailDescription(selected)}</p>
        {selected.significance && <p id={id + '-significance'}>{selected.significance}</p>}
      </div>
    </div>
    <div className="award-celebration-actions">
      <button type="button" className="award-celebration-primary" onClick={viewAward}>View award</button>
      <button type="button" onClick={onContinue}>Continue</button>
    </div>
  </dialog>
}

/** Committed unlocks survive route changes; errors remain non-blocking feedback. */
export function AwardFeedback() {
  const [notices, setNotices] = useState<QueuedNotice[]>([])
  const announced = useRef(new Set<string>())
  const nextId = useRef(0)
  useEffect(() => {
    const receive = (event: Event) => {
      const notice = readNotice((event as CustomEvent).detail)
      if (!notice) return
      if (notice.awards.length > 0) {
        notice.awards = notice.awards.filter(award => !announced.current.has(award.id))
        if (notice.awards.length === 0) return
        notice.awards.forEach(award => announced.current.add(award.id))
      }
      const queued = { ...notice, id: ++nextId.current }
      setNotices(current => notice.failed && current.some(item => item.failed && item.message === notice.message)
        ? current : [...current, queued])
    }
    window.addEventListener(AWARD_FEEDBACK_EVENT, receive)
    return () => window.removeEventListener(AWARD_FEEDBACK_EVENT, receive)
  }, [])

  // A stale recovery notice must not delay a freshly committed celebration.
  const notice = notices.find(item => item.awards.length > 0) ?? notices[0]
  const dismiss = () => setNotices(current => current.filter(item => item.id !== notice?.id))
  if (notice?.awards.length) return <AwardCelebration key={notice.id} awards={notice.awards} onContinue={dismiss} />

  return <div className="award-live-feedback" role="status" aria-live="polite" aria-atomic="true">
    {notice && <div className={`award-live-feedback-card${notice.failed ? ' award-live-feedback-card--error' : ''}`}>
      <button className="award-notice-dismiss" type="button" onClick={dismiss} aria-label="Dismiss award notification">×</button>
      <p className="award-notice-message">{notice.message}</p>
      <div className="award-notice-actions">
        <a href={applicationHref('/awards')} onClick={event => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setNotices([])
        }}>View Awards</a>
        <button type="button" onClick={dismiss}>Dismiss</button>
      </div>
    </div>}
  </div>
}
