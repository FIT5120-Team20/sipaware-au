import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SavedDrinkEditor } from '../components/SavedDrinkEditor'
import { SavedDrinkPicker } from '../components/SavedDrinkPicker'
import { DRINKING_RECORDS_STORAGE_KEY } from '../storage/drinkingRecordRepository'
import { SAVED_DRINKS_STORAGE_KEY } from '../storage/savedDrinkRepository'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { SavedDrink } from '../types/savedDrink'
import { ManualDrinkPage } from './ManualDrinkPage'

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

function storeSavedDrinks(savedDrinks: readonly SavedDrink[]) {
  window.localStorage.setItem(
    SAVED_DRINKS_STORAGE_KEY,
    JSON.stringify(savedDrinks),
  )
}

function readSavedDrinks(): SavedDrink[] {
  return JSON.parse(
    window.localStorage.getItem(SAVED_DRINKS_STORAGE_KEY) ?? '[]',
  ) as SavedDrink[]
}

function readHistory(): DrinkingRecord[] {
  return JSON.parse(
    window.localStorage.getItem(DRINKING_RECORDS_STORAGE_KEY) ?? '[]',
  ) as DrinkingRecord[]
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
  it('displays every saved drink with its stored reusable information', () => {
    storeSavedDrinks([savedSky, savedShiraz])
    render(<ManualDrinkPage />)

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
    storeSavedDrinks([savedSky, savedShiraz])
    const user = userEvent.setup()
    const view = render(<ManualDrinkPage />)

    await editSkyToLarge(user)

    expect(
      await screen.findByText('Sky Large was updated in My Drinks.'),
    ).toBeInTheDocument()
    const savedDrinks = readSavedDrinks()
    expect(savedDrinks).toHaveLength(2)
    expect(savedDrinks[0]).toMatchObject({
      id: savedSky.id,
      createdAt: savedSky.createdAt,
      drinkType: 'other',
      drinkName: 'Sky Large',
      servingVolumeMl: 500,
      abvPercent: 4.2,
    })
    expect(new Date(savedDrinks[0].updatedAt).getTime()).toBeGreaterThan(
      new Date(savedSky.updatedAt).getTime(),
    )
    expect(savedDrinks[1]).toEqual(savedShiraz)

    view.unmount()
    render(<ManualDrinkPage />)
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
    storeSavedDrinks([savedSky, savedShiraz])
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

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
    expect(readSavedDrinks()).toEqual([savedSky, savedShiraz])
  })

  it('requires explicit confirmation, supports cancel, and deletes only one drink', async () => {
    storeSavedDrinks([savedSky, savedShiraz])
    window.localStorage.setItem(
      DRINKING_RECORDS_STORAGE_KEY,
      JSON.stringify([existingHistoricalRecord]),
    )
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.click(
      screen.getByRole('button', { name: 'Delete Sky from My Drinks' }),
    )
    expect(screen.getByText('Delete Sky from My Drinks?')).toBeInTheDocument()
    expect(
      screen.getByText('This will not delete past drinking records.'),
    ).toBeInTheDocument()
    expect(readSavedDrinks()).toEqual([savedSky, savedShiraz])

    await user.click(screen.getByRole('button', { name: 'Keep Sky' }))
    expect(
      screen.queryByText('Delete Sky from My Drinks?'),
    ).not.toBeInTheDocument()
    expect(readSavedDrinks()).toEqual([savedSky, savedShiraz])

    await user.click(
      screen.getByRole('button', { name: 'Delete Sky from My Drinks' }),
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Yes, delete Sky from My Drinks',
      }),
    )

    expect(readSavedDrinks()).toEqual([savedShiraz])
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
    expect(readHistory()).toEqual([existingHistoricalRecord])
  })

  it('keeps a history snapshot unchanged through saved-drink edit and deletion', async () => {
    storeSavedDrinks([savedSky])
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

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
    const historySnapshot = readHistory()
    expect(historySnapshot[0]).toMatchObject({
      drinkName: 'Sky',
      servingVolumeMl: 300,
      abvPercent: 4,
    })

    await editSkyToLarge(user)
    expect(readHistory()).toEqual(historySnapshot)

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

    expect(readSavedDrinks()).toEqual([])
    expect(readHistory()).toEqual(historySnapshot)
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
        savedDrink={savedSky}
        onSave={() => {
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
        savedDrinks={[savedSky]}
        selectedSavedDrinkId={null}
        onSelect={() => undefined}
        onClear={() => undefined}
        onUpdate={() => undefined}
        onDelete={() => {
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
