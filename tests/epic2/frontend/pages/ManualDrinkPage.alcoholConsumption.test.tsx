/** Verifies US2.1 feedback reacts to committed browser-local record changes. */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ManualDrinkPage } from '../../../../frontend/src/features/drinks/pages/ManualDrinkPage'
import { IndexedDbDrinkingRecordRepository } from '../../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import { IndexedDbSavedDrinkRepository } from '../../../../frontend/src/features/drinks/storage/savedDrinkRepository'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'
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
): DrinkingRecord {
  const consumedAt = new Date(date)
  consumedAt.setHours(12, 0, 0, 0)

  return {
    id,
    drinkType: 'beer',
    drinkName,
    servingVolumeMl: 375,
    abvPercent: 5,
    amountConsumed: 1,
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
  it('recalculates after edit, delete, and new record persistence', async () => {
    await new IndexedDbDrinkingRecordRepository().add(
      recordForLocalDate('reactive-record', new Date()),
    )
    const user = userEvent.setup()
    await renderHydratedPage()

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
  })
})
