import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { HomePage } from '../../../frontend/src/pages/HomePage'

afterEach(() => {
  window.history.replaceState({}, '', '/')
  vi.restoreAllMocks()
})

it('shows the full logo with an accessible Home link within Iteration 3', () => {
  window.history.replaceState({}, '', '/iteration3/')
  render(<HomePage />)
  const link = screen.getByRole('link', { name: 'SipAware Home' })
  expect(link).toHaveAttribute('href', '/iteration3/')
  expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('SipAware')
  expect(screen.getByRole('img', { name: 'SipAware' })).toHaveAttribute('src', '/branding/sipaware-logo.png')
  expect(screen.getByRole('link', { name: /Record your drinks/ })).toHaveAttribute('href', '/iteration3/record')
})

it('returns to Home through the existing application navigation', () => {
  window.history.replaceState({}, '', '/iteration3/')
  const onNavigate = vi.fn()
  render(<HomePage onNavigate={onNavigate} />)
  expect(fireEvent.click(screen.getByRole('link', { name: 'SipAware Home' }))).toBe(false)
  expect(onNavigate).toHaveBeenCalledExactlyOnceWith('/')
})

it('preserves native new-tab behavior for modified logo clicks', () => {
  const onNavigate = vi.fn()
  render(<HomePage onNavigate={onNavigate} />)
  const link = screen.getByRole('link', { name: 'SipAware Home' })
  for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    expect(fireEvent.click(link, modifiers)).toBe(true)
  }
  expect(onNavigate).not.toHaveBeenCalled()
})

it('offers a native Home destination when no navigation callback is supplied', () => {
  window.history.replaceState({}, '', '/iteration3/')
  render(<HomePage />)
  expect(fireEvent.click(screen.getByRole('link', { name: 'SipAware Home' }))).toBe(true)
})
