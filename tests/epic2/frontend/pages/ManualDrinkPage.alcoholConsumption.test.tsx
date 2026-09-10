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

let pageView: ReturnType<typeof render>
let pageKey = 0
async function renderHydratedPage() {
 const records = await new IndexedDbDrinkingRecordRepository().list()
 window.history.replaceState({}, '', records.length ? '/record?record=' + records[0].id : '/trends#trends')
 pageView = render(<ManualDrinkPage key={++pageKey} initialView={records.length ? 'record' : 'history'} />)
 await screen.findByRole('heading', { name: records.length ? 'Drink recorded' : 'Your drinking dashboard' })
}
async function historyAction(action: 'Edit' | 'Delete', name: string) {
 window.history.replaceState({}, '', '/trends#history')
 pageView.rerender(<ManualDrinkPage key={++pageKey} initialView="history" />)
 fireEvent.click(await screen.findByRole('button', { name: 'Actions for ' + name }))
 return screen.getByRole('button', { name: action })
}
async function openRecordForm() {
 window.history.replaceState({}, '', '/record')
 pageView.rerender(<ManualDrinkPage key={++pageKey} initialView="record" />)
 fireEvent.click(await screen.findByRole('button', { name: 'Record Manually' }))
 await waitFor(() => expect(screen.getByLabelText('Drink type')).toBeEnabled())
}
async function getSummarySection(): Promise<HTMLElement> {
 const records = await new IndexedDbDrinkingRecordRepository().list()
 window.history.replaceState({}, '', records.length ? '/record?record=' + records[0].id : '/trends#trends')
 pageView.rerender(<ManualDrinkPage key={++pageKey} initialView={records.length ? 'record' : 'history'} />)
 return await screen.findByRole('region', { name: records.length ? 'Standard drink summary' : 'Your drinking dashboard' })
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
      within(await getSummarySection()).getByText(
        hasExactText('1.5 / 4 standard drinks'),
      ),
    ).toBeInTheDocument()

    await user.click(
      await historyAction('Edit', 'Current beer'),
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
      await within(await getSummarySection()).findByText(
        hasExactText('3.0 / 4 standard drinks'),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { name: 'Driving safety' }),
    ).toHaveLength(1)

    await user.click(
      await historyAction('Delete', 'Current beer'),
    )
    await user.click(
      screen.getByRole('button', { name: 'Delete' }),
    )
    expect(
      await within(await getSummarySection()).findByText(
        /No trend data yet/i,
      ),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Driving safety' }),
      ).not.toBeInTheDocument(),
    )

    await openRecordForm()
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
      screen.getByRole('button', { name: 'Record Drink' }),
    )

    expect(
      await within(await getSummarySection()).findByText(
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
      within(await getSummarySection()).getByText(
        /No trend data yet/i,
      ),
    ).toBeInTheDocument()
    await openRecordForm()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Record' }))
    fireEvent.click(screen.getByRole('button', { name: 'My Drinks' }))
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
      within(await getSummarySection()).getByText(
        /1 record is excluded because its date is in the future/i,
      ),
    ).toBeInTheDocument()
    window.history.replaceState({}, '', '/trends#history')
    pageView.rerender(<ManualDrinkPage key={++pageKey} initialView="history" />)
    await screen.findByRole('heading', { name: 'Your drinking records' })
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
      await historyAction('Edit', 'Date edit beer'),
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
    await getSummarySection()
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Driving safety' }),
      ).not.toBeInTheDocument(),
    )

    await user.click(
      await historyAction('Edit', 'Date edit beer'),
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
    await getSummarySection()
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
      await historyAction('Delete', 'First today beer'),
    )
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(screen.queryByText('First today beer')).not.toBeInTheDocument(),
    )
    await getSummarySection()
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
