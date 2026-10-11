// Browser geometry is supplied explicitly: jsdom has no layout. These checks
// guard destination visibility and motion policy without accessing personal data.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { revealContent } from '../../../../frontend/src/app/revealContent'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '' })
function panel(top: number, height: number) {
  document.body.innerHTML = '<div class="reference-app"><nav class="reference-navigation" style="position:fixed"></nav><section tabindex="-1"></section></div>'
  const target = document.querySelector('section')!
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top, bottom: top + height, height } as DOMRect)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('innerWidth', 1920); vi.stubGlobal('innerHeight', 900)
  vi.stubGlobal('scrollY', 0); vi.stubGlobal('visualViewport', null)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  return target
}
describe('explicit result reveal', () => {
  it('reveals the whole short panel on desktop, ignoring the vertical side rail', () => {
    const target = panel(830, 270)
    vi.spyOn(document.querySelector('nav')!, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 900, width: 220, height: 900 } as DOMRect)
    revealContent(target)
    expect(target).toHaveFocus()
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 212, behavior: 'smooth' })
  })
  it('places long panels below the top inset instead of skipping to their bottom', () => {
    const target = panel(830, 1500); revealContent(target)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 818, behavior: 'smooth' })
  })
  it('excludes mobile bottom navigation and respects reduced motion', () => {
    const target = panel(700, 200)
    vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    vi.spyOn(document.querySelector('nav')!, 'getBoundingClientRect').mockReturnValue({ top: 770, bottom: 844, width: 390, height: 74 } as DOMRect)
    revealContent(target)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 142, behavior: 'instant' })
  })
  it('focuses an already visible result without moving the page', () => {
    const target = panel(100, 270); revealContent(target)
    expect(target).toHaveFocus(); expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
