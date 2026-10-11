import { prepareNavigationScroll } from './navigationScroll'

/** Reveal an explicit action's result, without a second native focus scroll.
 * Category changes reveal just the result heading; selected-day panels fit wholly; long panels start below sticky controls. Only a
 * bottom navigation bar occludes the viewport, never the desktop side rail.
 */
export function revealContent(target: HTMLElement, wholePanel = true) {
  if (!target.isConnected || target.hidden) return
  prepareNavigationScroll()
  const viewport = window.visualViewport
  let top = (viewport?.offsetTop ?? 0) + 12
  let bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 12
  const root = target.closest('.reference-app') ?? document
  const tabs = target.closest('.history-trends-inner')?.querySelector<HTMLElement>('.history-trends-tabs')
  if (tabs) {
    const style = window.getComputedStyle(tabs)
    if (style.position === 'sticky' || style.position === 'fixed') {
      top += tabs.getBoundingClientRect().height + Math.max(0, parseFloat(style.top) || 0)
    }
  }
  const back = target.closest('.prototype-record-browser')?.querySelector<HTMLElement>('.prototype-sticky-back')
  if (back && window.getComputedStyle(back).position === 'sticky') {
    top = Math.max(top, back.getBoundingClientRect().height + 12)
  }
  const navigation = root.querySelector<HTMLElement>('.reference-navigation')
  if (navigation && window.getComputedStyle(navigation).position === 'fixed') {
    const bounds = navigation.getBoundingClientRect()
    if (bounds.width >= window.innerWidth / 2 && bounds.top > top) bottom = Math.min(bottom, bounds.top - 12)
  }
  const bounds = target.getBoundingClientRect()
  const available = bottom - top
  if (available <= 0) return
  const height = Math.min(bounds.height, available, wholePanel ? Infinity : 160)
  const delta = bounds.top < top ? bounds.top - top
    : bounds.top + height > bottom ? bounds.top + height - bottom : 0
  target.focus({ preventScroll: true })
  if (Math.abs(delta) > 1) window.scrollTo({
    top: Math.max(0, window.scrollY + delta),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
