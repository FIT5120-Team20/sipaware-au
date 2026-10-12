import { useEffect, useRef } from 'react'
import { applicationPath } from '../../app/entryPaths'
import { useCurrentLocalDateKey } from '../drinks/hooks/useCurrentLocalDateKey'
import { refreshAwards, updateAwardsForTrendsVisit } from './awardFeedbackEvents'

/** Startup/resume/month rollover refresh progress without manufacturing visits. */
export function AwardLifecycle() {
  const localDate = useCurrentLocalDateKey()
  const month = localDate.slice(0, 7)
  const lastMonth = useRef(month)
  const started = useRef(false)

  useEffect(() => {
    const visit = !started.current && applicationPath() === '/trends'
    started.current = true
    if (visit) updateAwardsForTrendsVisit()
    else void refreshAwards()
    const refresh = () => { void refreshAwards() }
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [])

  useEffect(() => {
    if (lastMonth.current === month) return
    lastMonth.current = month
    void refreshAwards()
  }, [month])

  return null
}
