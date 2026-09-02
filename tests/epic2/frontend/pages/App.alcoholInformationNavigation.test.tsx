import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../../../../frontend/src/App'
import { ALCOHOL_INFORMATION_RESPONSE } from '../fixtures/alcoholInformationFixture'

function informationResponse(): Response {
  return new Response(JSON.stringify(ALCOHOL_INFORMATION_RESPONSE), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

afterEach(() => {
  window.history.replaceState({}, '', '/')
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    })
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
})

describe('App alcohol-information navigation', () => {
  it('selects the existing Record a drink page at the root path', async () => {
    window.history.replaceState({}, '', '/')

    render(<App />)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Record a drink',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: 'Alcohol Guidelines & Legal Information',
      }),
    ).not.toBeInTheDocument()
  })

  it('selects the information page at its exact pathname', async () => {
    window.history.replaceState({}, '', '/alcohol-guidelines')
    vi.mocked(fetch).mockResolvedValueOnce(informationResponse())

    render(<App />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Alcohol Guidelines & Legal Information',
      }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('Verified medicines fixture content.'),
    ).toBeInTheDocument()
  })

  it('supports a direct page-and-topic deep link', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    window.history.replaceState(
      {},
      '',
      '/alcohol-guidelines#ALCOHOL_LEGAL',
    )
    vi.mocked(fetch).mockResolvedValueOnce(informationResponse())

    render(<App />)

    const heading = await screen.findByRole('heading', {
      level: 2,
      name: 'Alcohol and the law',
    })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('degrades safely for an unknown pathname', () => {
    window.history.replaceState({}, '', '/unknown')

    render(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Record a drink' }),
    ).toHaveAttribute('href', '/')
  })
})
