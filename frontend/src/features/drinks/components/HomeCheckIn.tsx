import { useEffect, useRef, useState } from 'react'
import { applicationHref } from '../../../app/entryPaths'
import { updateAwardsAfterCheckIn } from '../../awards/awardFeedbackEvents'
import { useCurrentLocalDateKey } from '../hooks/useCurrentLocalDateKey'
import { IndexedDbDailyCheckInRepository } from '../storage/dailyCheckInRepository'
import { IndexedDbDrinkingRecordRepository } from '../storage/drinkingRecordRepository'
import { getCurrentLocalCalendarDateKey, getRecordLocalCalendarDateKey } from '../utils/localCalendarDate'
import './homeCheckIn.css'

const checkIns = new IndexedDbDailyCheckInRepository()
const drinks = new IndexedDbDrinkingRecordRepository()
type Status = 'loading' | 'unrecorded' | 'alcohol-free' | 'drinks' | 'error'

/** Reads the same local records as History; viewing Home never confirms a day. */
export function HomeCheckIn() {
  const today = useCurrentLocalDateKey()
  const [state, setState] = useState<{ date: string; status: Status }>({ date: today, status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const status = state.date === today ? state.status : 'loading'

  useEffect(() => {
    let active = true
    let request = 0
    async function refresh() {
      const current = ++request
      try {
        const confirmations = await checkIns.initialize(today)
        const records = await drinks.list()
        const next: Status = records.some(record => getRecordLocalCalendarDateKey(record) === today)
          ? 'drinks' : confirmations.alcoholFreeDates.includes(today) ? 'alcohol-free' : 'unrecorded'
        if (active && current === request) setState({ date: today, status: next })
      } catch {
        if (active && current === request) setState({ date: today, status: 'error' })
      }
    }
    function visible() { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [today, revision])

  async function confirm() {
    if (pending.current) return
    if (today !== getCurrentLocalCalendarDateKey()) {
      setError('The date has changed. Please check today’s date and try again.')
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await checkIns.confirmAlcoholFree(today)
      setRevision(value => value + 1)
      await updateAwardsAfterCheckIn()
    } catch {
      setError('Could not confirm No alcohol. Check History for existing drinks, or try again.')
      setRevision(value => value + 1)
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <section className="home-check-in" id="todays-check-in" aria-labelledby="home-check-in-title" aria-busy={busy}>
    <h2 id="home-check-in-title">Today’s check-in</h2>
    <time dateTime={today}>{today}</time>
    <p role="status">{status === 'loading' ? 'Loading today’s check-in…'
      : status === 'error' ? 'Could not load today’s check-in.'
      : status === 'drinks' ? 'Check-in complete — drinking recorded today.'
      : status === 'alcohol-free' ? 'Check-in complete — no alcohol today. 0 standard drinks.'
      : 'No check-in recorded today. Missing records do not mean an alcohol-free day.'}</p>
    {error && <p role="alert">{error}</p>}
    <div className="home-check-in-actions">
      {status === 'error' && <button type="button" onClick={() => setRevision(value => value + 1)}>Retry check-in</button>}
      {status === 'unrecorded' && <button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? 'Saving…' : 'No alcohol'}</button>}
      <a href={applicationHref('/record?date=' + today)}>{status === 'drinks' ? 'Add a drink' : 'Record a drink'}</a>
      <a href={applicationHref('/trends#history')}>View History</a>
    </div>
  </section>
}
