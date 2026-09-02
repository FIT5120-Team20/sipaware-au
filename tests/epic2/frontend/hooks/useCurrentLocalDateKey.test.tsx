import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCurrentLocalDateKey } from '../../../../frontend/src/features/drinks/hooks/useCurrentLocalDateKey'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('useCurrentLocalDateKey', () => {
  it('rolls over at local midnight and keeps one scheduled timer', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 2, 23, 59, 59, 500))
    const { result, unmount } = renderHook(() => useCurrentLocalDateKey())

    expect(result.current).toBe('2026-09-02')
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(1_500))

    expect(result.current).toBe('2026-09-03')
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('refreshes and replaces the timer after focus and visible events', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 2, 12))
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout')
    const { result, unmount } = renderHook(() => useCurrentLocalDateKey())

    vi.setSystemTime(new Date(2026, 8, 3, 8))
    act(() => window.dispatchEvent(new Event('focus')))

    expect(result.current).toBe('2026-09-03')
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    vi.setSystemTime(new Date(2026, 8, 4, 9))
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(result.current).toBe('2026-09-04')
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(3)
  })
})
