/**
 * Keeps native date/time picker bounds current while a form stays open.
 * Minute rollover and focus/visibility refresh handle midnight and device sleep;
 * the shared submit validator independently reads a fresh clock before saving.
 */
import { useEffect, useState } from 'react'
import { getCurrentLocalCalendarDateKey } from '../utils/localCalendarDate'

function currentLimit() {
  const now = new Date()
  return {
    date: getCurrentLocalCalendarDateKey(now),
    time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
  }
}

export function useConsumptionTimeLimit() {
  const [limit, setLimit] = useState(currentLimit)
  function refresh() { setLimit(currentLimit()) }

  useEffect(() => {
    let timer: number
    function schedule() {
      timer = window.setTimeout(() => {
        setLimit(currentLimit())
        schedule()
      }, 60_000 - Date.now() % 60_000)
    }
    function wake() { setLimit(currentLimit()) }
    schedule()
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])

  return { ...limit, refresh }
}
