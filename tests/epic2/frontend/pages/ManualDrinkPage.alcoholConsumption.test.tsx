/** Verifies Epic 2 feedback reacts to committed browser-local record changes. */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ManualDrinkPage } from '../../../../frontend/src/features/drinks/pages/ManualDrinkPage'
import { IndexedDbDrinkingRecordRepository } from '../../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import { IndexedDbSavedDrinkRepository } from '../../../../frontend/src/features/drinks/storage/savedDrinkRepository'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'
import { ALCOHOL_INFORMATION_TOPIC_CODES } from '../../../../frontend/src/features/drinks/types/alcoholGuideline'
import type { SavedDrink } from '../../../../frontend/src/features/drinks/types/savedDrink'

function hasExactText(expected: string) {
  return (_content: string, element: Element | null) =>
    element?.textContent?.replace(/\s+/g, ' ').trim() === expected
}

function localDateInputValue(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function recordForLocalDate(
  id: string,
  date: Date,
  drinkName = 'Current beer',
  amountConsumed = 1,
): DrinkingRecord {
  const consumedAt = new Date(date)
  consumedAt.setHours(12, 0, 0, 0)

  return {
    id,
    drinkType: 'beer',
    drinkName,
    servingVolumeMl: 375,
    abvPercent: 5,
    amountConsumed,
    consumedAt: consumedAt.toISOString(),
    consumedTimezoneOffsetMinutes: consumedAt.getTimezoneOffset(),
    createdAt: new Date().toISOString(),
  }
}

async function renderHydratedPage() {
  render(<ManualDrinkPage />)
  await screen.findByRole('heading', { name: 'Standard drink summary' })
  await waitFor(() => expect(screen.getByLabelText('Drink type')).toBeEnabled())
}

function getSummarySection(): HTMLElement {
  const heading = screen.getByRole('heading', {
    name: 'Standard drink summary',
  })
  const section = heading.closest('section')
  if (!(section instanceof HTMLElement)) {
    throw new Error('Expected the standard drink summary section.')
  }
  return section
}

describe('ManualDrinkPage alcohol consumption integration', () => {
  it.each([
    ['no drinking history', null],
    ['historical records only', -1],
  ] as const)('does not show driving guidance for %s', async (_name, dayOffset) => {
    if (dayOffset !== null) {
      const historicalDate = new Date()
      historicalDate.setDate(historicalDate.getDate() + dayOffset)
      await new IndexedDbDrinkingRecordRepository().add(
        recordForLocalDate('historical-record', historicalDate),
      )
    }

    await renderHydratedPage()

    expect(
      screen.queryByRole('heading', { name: 'Driving safety' }),
    ).not.toBeInTheDocument()
  })

  it('recalculates after edit, delete, and new record persistence', async () => {
    await new IndexedDbDrinkingRecordRepository().add(
      recordForLocalDate('reactive-record', new Date()),
    )
    const user = userEvent.setup()
    await renderHydratedPage()

    const guidance = screen
      .getByRole('heading', { name: 'Driving safety' })
      .closest('section')
    if (!(guidance instanceof HTMLElement)) {
      throw new Error('Expected the driving safety guidance section.')
    }
    expect(
      within(guidance).getByText('Avoid drinking and driving.'),
    ).toBeInTheDocument()
    expect(guidance).toHaveTextContent(
      'Alcohol can impair driving and increase crash risk.',
    )
    expect(guidance).toHaveTextContent(
      'Being below an alcohol guideline does not mean it is safe to drive.',
    )
    expect(guidance).toHaveTextContent(
      'SipAware does not estimate BAC or tell you when it is safe to drive.',
    )
    expect(guidance).not.toHaveTextContent(/BAC\s*[:=]?\s*\d/i)
    expect(guidance).not.toHaveTextContent(/safe to drive (at|in)\b/i)
    expect(guidance).not.toHaveTextContent(/legal limit|legally fit/i)
    expect(guidance).not.toHaveTextContent(
      /personalised (driving )?(recommendation|clearance)|you (can|may) drive/i,
    )
    expect(
      within(guidance).getByRole('link', { name: 'Why this matters' }),
    ).toHaveAttribute('href', '/alcohol-guidelines#ALCOHOL_DRIVING')
    expect(within(guidance).queryByRole('button')).not.toBeInTheDocument()
    expect(ALCOHOL_INFORMATION_TOPIC_CODES).toContain('ALCOHOL_DRIVING')

    expect(
      within(getSummarySection()).getByText(
        hasExactText('1.5 / 4 standard drinks'),
      ),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Edit drinking record for Current beer',
      }),
    )
    const editorHeading = screen.getByRole('heading', {
      name: 'Edit drinking record',
    })
    const editor = editorHeading.closest('form')
    if (!(editor instanceof HTMLFormElement)) {
      throw new Error('Expected a drinking record editor.')
    }
    fireEvent.change(
      within(editor).getByLabelText('Number of servings consumed'),
      { target: { value: '2' } },
    )
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))

    expect(
      await within(getSummarySection()).findByText(
        hasExactText('3.0 / 4 standard drinks'),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { name: 'Driving safety' }),
    ).toHaveLength(1)

    await user.click(
      screen.getByRole('button', {
        name: 'Delete drinking record for Current beer',
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Yes, delete record' }),
    )
    expect(
      await within(getSummarySection()).findByText(
        /No current or past drinking history/i,
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Driving safety' }),
      ).not.toBeInTheDocument(),
    )

    await user.selectOptions(screen.getByLabelText('Drink type'), 'other')
    await user.type(screen.getByLabelText('Drink name'), 'New custom drink')
    await user.type(screen.getByLabelText('Custom volume (mL)'), '375')
    await user.type(screen.getByLabelText('ABV (%)'), '5')
    await user.type(
      screen.getByLabelText('Number of servings consumed'),
      '1',
    )
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: localDateInputValue() },
    })
    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )

    expect(
      await within(getSummarySection()).findByText(
        hasExactText('1.5 / 4 standard drinks'),
      ),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Driving safety' }),
    ).toBeInTheDocument()
  })

  it('does not count a SavedDrink merely because it is saved', async () => {
    const savedDrink: SavedDrink = {
      id: 'saved-only',
      drinkType: 'wine',
      drinkName: 'Saved wine',
      servingVolumeMl: 150,
      abvPercent: 13.5,
      createdAt: '2026-09-01T01:00:00.000Z',
      updatedAt: '2026-09-01T01:00:00.000Z',
    }
    await new IndexedDbSavedDrinkRepository().add(savedDrink)

    await renderHydratedPage()

    expect(
      within(getSummarySection()).getByText(
        /No current or past drinking history/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Saved wine.*150 mL.*13.5% ABV/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Driving safety' }),
    ).not.toBeInTheDocument()
  })

  it('keeps a future record stored and visible while excluding it from feedback', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    const futureRecord = recordForLocalDate(
      'future-record',
      futureDate,
      'Future beer',
    )
    const repository = new IndexedDbDrinkingRecordRepository()
    await repository.add(futureRecord)

    await renderHydratedPage()

    expect(
      within(getSummarySection()).getByText(
        /1 record is excluded because its date is in the future/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Future beer')).toBeInTheDocument()
    await expect(repository.list()).resolves.toEqual([futureRecord])
    expect(
      screen.queryByRole('heading', { name: 'Driving safety' }),
    ).not.toBeInTheDocument()
  })

  it('reacts when an edited record moves out of and back into today', async () => {
    await new IndexedDbDrinkingRecordRepository().add(
      recordForLocalDate('date-edit-record', new Date(), 'Date edit beer'),
    )
    const user = userEvent.setup()
    await renderHydratedPage()
    expect(
      screen.getByRole('heading', { name: 'Driving safety' }),
    ).toBeInTheDocument()

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    await user.click(
      screen.getByRole('button', {
        name: 'Edit drinking record for Date edit beer',
      }),
    )
    let editorHeading = screen.getByRole('heading', {
      name: 'Edit drinking record',
    })
    let editor = editorHeading.closest('form')
    if (!(editor instanceof HTMLFormElement)) {
      throw new Error('Expected a drinking record editor.')
    }
    fireEvent.change(within(editor).getByLabelText('Date'), {
      target: { value: localDateInputValue(yesterday) },
    })
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Driving safety' }),
      ).not.toBeInTheDocument(),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Edit drinking record for Date edit beer',
      }),
    )
    editorHeading = screen.getByRole('heading', {
      name: 'Edit drinking record',
    })
    editor = editorHeading.closest('form')
    if (!(editor instanceof HTMLFormElement)) {
      throw new Error('Expected a drinking record editor.')
    }
    fireEvent.change(within(editor).getByLabelText('Date'), {
      target: { value: localDateInputValue() },
    })
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))
    expect(
      await screen.findByRole('heading', { name: 'Driving safety' }),
    ).toBeInTheDocument()
  })

  it('shows one reminder and retains it while another today record remains', async () => {
    const repository = new IndexedDbDrinkingRecordRepository()
    await repository.add(
      recordForLocalDate('first-today', new Date(), 'First today beer'),
    )
    await repository.add(
      recordForLocalDate('second-today', new Date(), 'Second today beer'),
    )
    const user = userEvent.setup()
    await renderHydratedPage()

    expect(
      screen.getAllByRole('heading', { name: 'Driving safety' }),
    ).toHaveLength(1)

    await user.click(
      screen.getByRole('button', {
        name: 'Delete drinking record for First today beer',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Yes, delete record' }))
    await waitFor(() =>
      expect(screen.queryByText('First today beer')).not.toBeInTheDocument(),
    )
    expect(
      screen.getAllByRole('heading', { name: 'Driving safety' }),
    ).toHaveLength(1)
  })

  it.each([
    ['below', 1, 'Below the guideline'],
    ['above', 4, 'Above the guideline'],
  ] as const)(
    'shows driving guidance when today is %s the DAILY guideline',
    async (_name, amountConsumed, expectedStatus) => {
      await new IndexedDbDrinkingRecordRepository().add(
        recordForLocalDate(
          'guideline-independent',
          new Date(),
          'Guideline independent beer',
          amountConsumed,
        ),
      )

      await renderHydratedPage()

      expect(screen.getByText(expectedStatus)).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: 'Driving safety' }),
      ).toBeInTheDocument()
    },
  )

  it('keeps driving guidance available when the guideline API fails', async () => {
    await new IndexedDbDrinkingRecordRepository().add(
      recordForLocalDate('guideline-failure', new Date()),
    )
    const defaultFetch = globalThis.fetch
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith('/api/reference/alcohol-guidelines')
          ? Promise.resolve(new Response(null, { status: 503 }))
          : defaultFetch(input, init),
      ),
    )

    await renderHydratedPage()

    expect(
      await screen.findByText(/guideline values are temporarily unavailable/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Driving safety' }),
    ).toBeInTheDocument()
  })
})
