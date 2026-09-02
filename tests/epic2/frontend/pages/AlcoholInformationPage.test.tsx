import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AlcoholInformationPage } from '../../../../frontend/src/features/drinks/pages/AlcoholInformationPage'
import { ALCOHOL_INFORMATION_RESPONSE } from '../fixtures/alcoholInformationFixture'

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
let scrollIntoView: ReturnType<typeof vi.fn>

beforeEach(() => {
  window.history.replaceState({}, '', '/alcohol-guidelines')
  scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })
})

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

describe('AlcoholInformationPage', () => {
  it('shows a neutral loading state without displaying information facts', () => {
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => undefined))

    render(<AlcoholInformationPage />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading alcohol information',
    )
    expect(
      screen.queryByText('Verified standard drink fixture content.'),
    ).not.toBeInTheDocument()
  })

  it('renders six semantic sections, provenance, safe links and AU dates', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(ALCOHOL_INFORMATION_RESPONSE),
    )

    render(<AlcoholInformationPage />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Alcohol Guidelines & Legal Information',
      }),
    ).toBeInTheDocument()
    await screen.findByText('Verified legal fixture content.')

    for (const topic of ALCOHOL_INFORMATION_RESPONSE.topics) {
      const heading = screen.getByRole('heading', {
        level: 2,
        name: topic.displayName,
      })
      const section = heading.closest('section')
      expect(section).toHaveAttribute('id', topic.topicCode)
      expect(section).toHaveAttribute('aria-labelledby', heading.id)
    }

    const standardSection = screen
      .getByRole('heading', {
        level: 2,
        name: 'What is a Standard Drink?',
      })
      .closest('section')
    if (!(standardSection instanceof HTMLElement)) {
      throw new Error('Expected the standard-drink section.')
    }

    expect(
      within(standardSection).getByText('Primary source'),
    ).toBeInTheDocument()
    expect(
      within(standardSection).getByText('Supporting source'),
    ).toBeInTheDocument()
    expect(
      within(standardSection).getByText('29 August 2026').closest('p'),
    ).toHaveTextContent(
      'Information last verified 29 August 2026',
    )
    const links = within(standardSection).getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noreferrer')
    }
    expect(
      screen.getByRole('navigation', {
        name: 'Alcohol information topics',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(document.body).not.toHaveTextContent(
      /your BAC is|safe to drive at|legal for you|medicine checker/i,
    )
  })

  it('shows a failure without fallback facts and retries successfully', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(ALCOHOL_INFORMATION_RESPONSE))

    render(<AlcoholInformationPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alcohol information is temporarily unavailable',
    )
    expect(
      screen.queryByText('Verified guideline fixture content.'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByText('Verified guideline fixture content.'),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('uses the same unavailable state for a malformed response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ topics: [] }))

    render(<AlcoholInformationPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alcohol information is temporarily unavailable',
    )
    expect(
      screen.queryByText('Verified ageing fixture content.'),
    ).not.toBeInTheDocument()
  })

  it('scrolls and focuses a valid deep-link heading after data loads', async () => {
    window.history.replaceState(
      {},
      '',
      '/alcohol-guidelines#ALCOHOL_AGEING',
    )
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(ALCOHOL_INFORMATION_RESPONSE),
    )

    render(<AlcoholInformationPage />)

    const heading = await screen.findByRole('heading', {
      level: 2,
      name: 'Alcohol and ageing',
    })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('responds to hash changes using the same focus behaviour', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(ALCOHOL_INFORMATION_RESPONSE),
    )
    render(<AlcoholInformationPage />)
    const heading = await screen.findByRole('heading', {
      level: 2,
      name: 'Alcohol and driving',
    })

    window.history.replaceState(
      {},
      '',
      '/alcohol-guidelines#ALCOHOL_DRIVING',
    )
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await waitFor(() => expect(heading).toHaveFocus())
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('does not force focus or scrolling when no hash is present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(ALCOHOL_INFORMATION_RESPONSE),
    )
    render(<AlcoholInformationPage />)

    const heading = await screen.findByRole('heading', {
      level: 2,
      name: 'What is a Standard Drink?',
    })

    expect(heading).not.toHaveFocus()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('shows a calm message and no forced focus for an unknown hash', async () => {
    window.history.replaceState({}, '', '/alcohol-guidelines#UNKNOWN_TOPIC')
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(ALCOHOL_INFORMATION_RESPONSE),
    )

    render(<AlcoholInformationPage />)

    expect(
      screen.getByText(/That information section was not found/i),
    ).toBeInTheDocument()
    await screen.findByText('Verified legal fixture content.')
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Alcohol Guidelines & Legal Information',
      }),
    ).not.toHaveFocus()
  })

  it('keeps other verified sections when a known requested topic is absent', async () => {
    window.history.replaceState(
      {},
      '',
      '/alcohol-guidelines#ALCOHOL_AGEING',
    )
    const informationWithoutAgeing = {
      topics: ALCOHOL_INFORMATION_RESPONSE.topics.filter(
        (topic) => topic.topicCode !== 'ALCOHOL_AGEING',
      ),
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(informationWithoutAgeing),
    )

    render(<AlcoholInformationPage />)

    expect(
      await screen.findByText(
        /requested information section is currently unavailable/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Verified standard drink fixture content.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Verified ageing fixture content.'),
    ).not.toBeInTheDocument()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
