/** Protects My Drinks editing and deletion without mutating drinking history. */

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DRINK_REFERENCE_CATEGORIES } from '../fixtures/drinkReferenceFixture'
import { SavedDrinkEditor } from '../../../../frontend/src/features/drinks/components/SavedDrinkEditor'
import { SavedDrinkPicker } from '../../../../frontend/src/features/drinks/components/SavedDrinkPicker'
import {
  IndexedDbDrinkingRecordRepository,
} from '../../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import {
  IndexedDbSavedDrinkRepository,
} from '../../../../frontend/src/features/drinks/storage/savedDrinkRepository'
import { ManualDrinkPage } from '../../../../frontend/src/features/drinks/pages/ManualDrinkPage'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'
import type { SavedDrink } from '../../../../frontend/src/features/drinks/types/savedDrink'

const savedSky: SavedDrink = {
  id: 'saved-sky',
  drinkType: 'beer',
  drinkName: 'Sky',
  servingVolumeMl: 300,
  abvPercent: 4,
  createdAt: '2026-08-25T08:00:00.000Z',
  updatedAt: '2026-08-25T08:00:00.000Z',
}

const savedShiraz: SavedDrink = {
  id: 'saved-shiraz',
  drinkType: 'wine',
  drinkName: 'Shiraz',
  servingVolumeMl: 150,
  abvPercent: 13.5,
  createdAt: '2026-08-24T08:00:00.000Z',
  updatedAt: '2026-08-24T08:00:00.000Z',
}

const existingHistoricalRecord: DrinkingRecord = {
  id: 'historical-sky-record',
  drinkType: 'beer',
  drinkName: 'Sky',
  servingVolumeMl: 300,
  abvPercent: 4,
  amountConsumed: 1,
  consumedAt: '2026-08-25T09:30:00.000Z',
  consumedTimezoneOffsetMinutes: 0,
  createdAt: '2026-08-25T09:31:00.000Z',
}

async function storeSavedDrinks(savedDrinks: readonly SavedDrink[]) {
  const repository = new IndexedDbSavedDrinkRepository()
  for (const savedDrink of savedDrinks) {
    await repository.add(savedDrink)
  }
}

function readSavedDrinks(): Promise<SavedDrink[]> {
  return new IndexedDbSavedDrinkRepository().list()
}

function readHistory(): Promise<DrinkingRecord[]> {
  return new IndexedDbDrinkingRecordRepository().list()
}

async function renderHydratedPage() {
  const view = render(<ManualDrinkPage />)
  await screen.findByLabelText('Drink type')
  return view
}

function getEditor(name: string): HTMLFormElement {
  const heading = screen.getByRole('heading', { name: `Edit ${name}` })
  const editor = heading.closest('form')
  if (!(editor instanceof HTMLFormElement)) {
    throw new Error(`Expected an edit form for ${name}.`)
  }
  return editor
}

async function editSkyToLarge(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Edit Sky' }))
  const editor = getEditor('Sky')

  fireEvent.change(within(editor).getByLabelText('Edit drink name'), {
    target: { value: 'Sky Large' },
  })
  await user.selectOptions(
    within(editor).getByLabelText('Edit drink type'),
    'other',
  )
  fireEvent.change(
    within(editor).getByLabelText('Edit custom volume (mL)'),
    { target: { value: '500' } },
  )
  fireEvent.change(within(editor).getByLabelText('Edit ABV (%)'), {
    target: { value: '4.2' },
  })
  await user.click(within(editor).getByRole('button', { name: 'Save changes' }))
}

describe('ManualDrinkPage My Drinks management', () => {
  it('displays every saved drink with its stored reusable information', async () => {
    await storeSavedDrinks([savedSky, savedShiraz])
    await renderHydratedPage()

    expect(
      screen.getByRole('button', {
        name: /Sky.*Beer.*300 mL.*4% ABV/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Shiraz.*Wine.*150 mL.*13.5% ABV/,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Sky' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete Sky from My Drinks' }),
    ).toBeInTheDocument()
  })

  it('updates only one saved drink and quick-select uses its new values', async () => {
    await storeSavedDrinks([savedSky, savedShiraz])
    const user = userEvent.setup()
    const view = await renderHydratedPage()

    await editSkyToLarge(user)

    expect(
      await screen.findByText('Sky Large was updated in My Drinks.'),
    ).toBeInTheDocument()
    const savedDrinks = await readSavedDrinks()
    expect(savedDrinks).toHaveLength(2)
    expect(savedDrinks.find((drink) => drink.id === savedSky.id)).toMatchObject({
      id: savedSky.id,
      createdAt: savedSky.createdAt,
      drinkType: 'other',
      drinkName: 'Sky Large',
      servingVolumeMl: 500,
      abvPercent: 4.2,
    })
    const updatedSky = savedDrinks.find((drink) => drink.id === savedSky.id)
    expect(updatedSky).toBeDefined()
    expect(new Date(updatedSky?.updatedAt ?? '').getTime()).toBeGreaterThan(
      new Date(savedSky.updatedAt).getTime(),
    )
    expect(savedDrinks).toContainEqual(savedShiraz)

    view.unmount()
    await renderHydratedPage()
    await user.click(
      screen.getByRole('button', {
        name: /Sky Large.*Other.*500 mL.*4.2% ABV/,
      }),
    )
    expect(screen.getByLabelText('Drink type')).toHaveValue('other')
    expect(screen.getByLabelText('Drink name')).toHaveValue('Sky Large')
    expect(screen.getByLabelText('Serving size / volume')).toHaveValue('custom')
    expect(screen.getByLabelText('Custom volume (mL)')).toHaveValue(500)
    expect(screen.getByLabelText('ABV (%)')).toHaveValue(4.2)
  })

  it('rejects invalid edits without changing stored data', async () => {
    await storeSavedDrinks([savedSky, savedShiraz])
    const user = userEvent.setup()
    await renderHydratedPage()

    await user.click(screen.getByRole('button', { name: 'Edit Sky' }))
    const editor = getEditor('Sky')
    fireEvent.change(within(editor).getByLabelText('Edit drink name'), {
      target: { value: '   ' },
    })
    await user.click(
      within(editor).getByRole('button', { name: 'Save changes' }),
    )

    expect(
      await within(editor).findByText(
        'Check the highlighted details before saving changes.',
      ),
    ).toBeInTheDocument()
    expect(within(editor).getByText('Enter a drink name.')).toBeInTheDocument()
    expect(within(editor).getByLabelText('Edit drink name')).toHaveFocus()
    await expect(readSavedDrinks()).resolves.toEqual([savedShiraz, savedSky])
  })

  it('requires explicit confirmation, supports cancel, and deletes only one drink', async () => {
    await storeSavedDrinks([savedSky, savedShiraz])
    await new IndexedDbDrinkingRecordRepository().add(existingHistoricalRecord)
    const user = userEvent.setup()
    await renderHydratedPage()

    await user.click(
      screen.getByRole('button', { name: 'Delete Sky from My Drinks' }),
    )
    expect(screen.getByText('Delete Sky from My Drinks?')).toBeInTheDocument()
    expect(
      screen.getByText('This will not delete past drinking records.'),
    ).toBeInTheDocument()
    await expect(readSavedDrinks()).resolves.toEqual([savedShiraz, savedSky])

    await user.click(screen.getByRole('button', { name: 'Keep Sky' }))
    expect(
      screen.queryByText('Delete Sky from My Drinks?'),
    ).not.toBeInTheDocument()
    await expect(readSavedDrinks()).resolves.toEqual([savedShiraz, savedSky])

    await user.click(
      screen.getByRole('button', { name: 'Delete Sky from My Drinks' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Yes, delete Sky from My Drinks',
      }),
    )

    await expect(readSavedDrinks()).resolves.toEqual([savedShiraz])
    expect(
      screen.queryByRole('button', {
        name: /Sky.*Beer.*300 mL.*4% ABV/,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Shiraz.*Wine.*150 mL.*13.5% ABV/,
      }),
    ).toBeInTheDocument()
    await expect(readHistory()).resolves.toEqual([existingHistoricalRecord])
  })

  it('keeps a history snapshot unchanged through saved-drink edit and deletion', async () => {
    await storeSavedDrinks([savedSky])
    const user = userEvent.setup()
    await renderHydratedPage()

    await user.click(
      screen.getByRole('button', {
        name: /Sky.*Beer.*300 mL.*4% ABV/,
      }),
    )
    fireEvent.change(screen.getByLabelText('Number of servings consumed'), {
      target: { value: '1' },
    })
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-08-26' },
    })
    fireEvent.change(screen.getByLabelText('Time'), {
      target: { value: '19:30' },
    })
    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )
    const historySnapshot = await readHistory()
    expect(historySnapshot[0]).toMatchObject({
      drinkName: 'Sky',
      servingVolumeMl: 300,
      abvPercent: 4,
    })

    await editSkyToLarge(user)
    await expect(readHistory()).resolves.toEqual(historySnapshot)

    await user.click(
      screen.getByRole('button', {
        name: 'Delete Sky Large from My Drinks',
      }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Yes, delete Sky Large from My Drinks',
      }),
    )

    await expect(readSavedDrinks()).resolves.toEqual([])
    await expect(readHistory()).resolves.toEqual(historySnapshot)
    const recentRecordsHeading = screen.getByRole('heading', {
      name: 'Recent records',
    })
    const recentRecordsSection = recentRecordsHeading.closest('section')
    expect(recentRecordsSection).not.toBeNull()
    expect(
      within(recentRecordsSection as HTMLElement).getByText('Sky'),
    ).toBeInTheDocument()
    expect(
      within(recentRecordsSection as HTMLElement).queryByText('Sky Large'),
    ).not.toBeInTheDocument()
  })
})

describe('SavedDrinkEditor failures', () => {
  it('retains edits and explains when persistence fails', async () => {
    const user = userEvent.setup()
    render(
      <SavedDrinkEditor
        referenceCategories={DRINK_REFERENCE_CATEGORIES}
        savedDrink={savedSky}
        onSave={async () => {
          throw new Error('Storage unavailable')
        }}
        onCancel={() => undefined}
      />,
    )

    fireEvent.change(screen.getByLabelText('Edit drink name'), {
      target: { value: 'Sky Large' },
    })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText(/Changes could not be saved on this device/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Edit drink name')).toHaveValue('Sky Large')
  })
})

describe('SavedDrinkPicker deletion failures', () => {
  it('keeps the drink visible and explains when deletion fails', async () => {
    const user = userEvent.setup()
    render(
      <SavedDrinkPicker
        referenceCategories={DRINK_REFERENCE_CATEGORIES}
        savedDrinks={[savedSky]}
        selectedSavedDrinkId={null}
        onSelect={() => undefined}
        onClear={() => undefined}
        onUpdate={() => undefined}
        onDelete={async () => {
          throw new Error('Storage unavailable')
        }}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Delete Sky from My Drinks' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Yes, delete Sky from My Drinks',
      }),
    )

    expect(
      await screen.findByText(/could not be deleted from My Drinks/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Sky.*Beer.*300 mL.*4% ABV/,
      }),
    ).toBeInTheDocument()
  })
})
