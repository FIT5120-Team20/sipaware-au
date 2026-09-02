/**
 * Supplies the current device-local date to browser-local summary calculations.
 *
 * It owns rollover lifecycle only, not consumption calculations. Rebuilding the
 * timer after focus or visibility changes handles sleep, clock, and timezone
 * changes without leaving a timer anchored to an obsolete local midnight.
 */
import { useEffect, useState } from 'react'

import {
  getCurrentLocalCalendarDateKey,
  type LocalCalendarDateKey,
} from '../utils/localCalendarDate'

export function useCurrentLocalDateKey(): LocalCalendarDateKey {
  const [currentDateKey, setCurrentDateKey] = useState(
    getCurrentLocalCalendarDateKey,
  )

  useEffect(() => {
    let midnightTimer: number | undefined
    let isActive = true

    function refreshDateKey() {
      if (isActive) {
        setCurrentDateKey(getCurrentLocalCalendarDateKey())
      }
    }

    function clearMidnightTimer() {
      if (midnightTimer !== undefined) {
        window.clearTimeout(midnightTimer)
        midnightTimer = undefined
      }
    }

    function scheduleNextLocalMidnight() {
      clearMidnightTimer()
      if (!isActive) {
        return
      }

      const now = new Date()
      const nextLocalDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
      )
      midnightTimer = window.setTimeout(() => {
        midnightTimer = undefined
        refreshDateKey()
        scheduleNextLocalMidnight()
      }, nextLocalDay.getTime() - now.getTime())
    }

    function refreshAndReschedule() {
      refreshDateKey()
      scheduleNextLocalMidnight()
    }

    function refreshAfterVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshAndReschedule()
      }
    }

    scheduleNextLocalMidnight()
    window.addEventListener('focus', refreshAndReschedule)
    document.addEventListener('visibilitychange', refreshAfterVisibilityChange)

    return () => {
      isActive = false
      clearMidnightTimer()
      window.removeEventListener('focus', refreshAndReschedule)
      document.removeEventListener(
        'visibilitychange',
        refreshAfterVisibilityChange,
      )
    }
  }, [])

  return currentDateKey
}
