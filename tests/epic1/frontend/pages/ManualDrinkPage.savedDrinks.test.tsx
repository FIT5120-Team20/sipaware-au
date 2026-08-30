/** Protects saved-drink reuse, independent history snapshots, and failure handling. */

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DRINK_REFERENCE_CATEGORIES } from '../fixtures/drinkReferenceFixture'
import { ManualDrinkForm } from '../../../../frontend/src/features/drinks/components/ManualDrinkForm'
import {
  IndexedDbDrinkingRecordRepository,
} from '../../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import {
  IndexedDbSavedDrinkRepository,
} from '../../../../frontend/src/features/drinks/storage/savedDrinkRepository'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'
import type { SavedDrink } from '../../../../frontend/src/features/drinks/types/savedDrink'
import { ManualDrinkPage } from '../../../../frontend/src/features/drinks/pages/ManualDrinkPage'

const savedCarltonDraught: SavedDrink = {
  id: 'saved-carlton-draught',
  drinkType: 'beer',
  drinkName: 'Carlton Draught',
  servingVolumeMl: 375,
  abvPercent: 4.6,
  createdAt: '2026-08-25T08:00:00.000Z',
  updatedAt: '2026-08-25T08:00:00.000Z',
}

const existingSavedDrink: SavedDrink = {
  id: 'saved-shiraz',
  drinkType: 'wine',
  drinkName: 'Shiraz',
  servingVolumeMl: 150,
  abvPercent: 13.5,
  createdAt: '2026-08-24T08:00:00.000Z',
  updatedAt: '2026-08-24T08:00:00.000Z',
}

const existingRecord: DrinkingRecord = {
  id: 'existing-history-record',
  drinkType: 'wine',
  drinkName: 'Existing Shiraz',
  servingVolumeMl: 150,
  abvPercent: 13,
  amountConsumed: 1,
  consumedAt: '2026-08-25T09:30:00.000Z',
  consumedTimezoneOffsetMinutes: 0,
  createdAt: '2026-08-25T09:31:00.000Z',
}

async function enterReusableDrinkDetails() {
  const user = userEvent.setup()

  await user.selectOptions(screen.getByLabelText('Drink type'), 'beer')
  fireEvent.change(screen.getByLabelText('Drink name'), {
    target: { value: '  Pale Ale  ' },
  })
  await user.selectOptions(
    screen.getByLabelText('Serving size / volume'),
    '375',
  )
  fireEvent.change(screen.getByLabelText('ABV (%)'), {
    target: { value: '4.5' },
  })

  return user
}

async function storeSavedDrinks(savedDrinks: readonly SavedDrink[]) {
  const repository = new IndexedDbSavedDrinkRepository()
  for (const savedDrink of savedDrinks) {
    await repository.add(savedDrink)
  }
}

async function renderHydratedPage() {
  const view = render(<ManualDrinkPage />)
  await screen.findByLabelText('Drink type')
  return view
}

describe('ManualDrinkPage saved drinks', () => {
  it('saves only reusable drink data, preserves existing data, and reloads it', async () => {
    await storeSavedDrinks([existingSavedDrink])
    await new IndexedDbDrinkingRecordRepository().add(existingRecord)
    const view = await renderHydratedPage()
    const user = await enterReusableDrinkDetails()

    await user.click(
      screen.getByRole('button', {
        name: 'Save this drink to My Drinks',
      }),
    )

    expect(
      await screen.findByText('Drink saved to My Drinks on this device.'),
    ).toBeInTheDocument()
    const savedDrinks = await new IndexedDbSavedDrinkRepository().list()

    expect(savedDrinks).toHaveLength(2)
    expect(savedDrinks[0]).toEqual(existingSavedDrink)
    expect(savedDrinks[1]).toMatchObject({
      drinkType: 'beer',
      drinkName: 'Pale Ale',
      servingVolumeMl: 375,
      abvPercent: 4.5,
    })
    expect(savedDrinks[1].id).not.toHaveLength(0)
    expect(savedDrinks[1].createdAt).toBe(savedDrinks[1].updatedAt)
    expect(savedDrinks[1]).not.toHaveProperty('amountConsumed')
    expect(savedDrinks[1]).not.toHaveProperty('consumedAt')
    expect(savedDrinks[1]).not.toHaveProperty('date')
    expect(savedDrinks[1]).not.toHaveProperty('time')
    await expect(
      new IndexedDbDrinkingRecordRepository().list(),
    ).resolves.toEqual([existingRecord])

    view.unmount()
    await renderHydratedPage()
    expect(
      screen.getByRole('button', {
        name: /Pale Ale.*Beer.*375 mL.*4.5% ABV/,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Shiraz.*Wine.*150 mL.*13.5% ABV/,
      }),
    ).toBeInTheDocument()
  })

  it('loads a saved drink and leaves only current occasion details to enter', async () => {
    await storeSavedDrinks([savedCarltonDraught])
    const user = userEvent.setup()
    await renderHydratedPage()

    await user.click(
      screen.getByRole('button', {
        name: /Carlton Draught.*Beer.*375 mL.*4.6% ABV/,
      }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Using Carlton Draught from My Drinks. The saved details are filled in below and your saved drink will remain unchanged.',
    )
    expect(screen.getByLabelText('Drink type')).toHaveValue('beer')
    expect(screen.getByLabelText('Drink type')).toBeDisabled()
    expect(screen.getByLabelText('Drink name')).toHaveValue('Carlton Draught')
    expect(screen.getByLabelText('Drink name')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Serving size / volume')).toHaveValue('custom')
    expect(screen.getByLabelText('Serving size / volume')).toBeDisabled()
    expect(screen.getByLabelText('Custom volume (mL)')).toHaveValue(375)
    expect(screen.getByLabelText('Custom volume (mL)')).toHaveAttribute(
      'readonly',
    )
    expect(screen.getByLabelText('ABV (%)')).toHaveValue(4.6)
    expect(screen.getByLabelText('ABV (%)')).toHaveAttribute('readonly')

    fireEvent.change(screen.getByLabelText('Number of servings consumed'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-08-26' },
    })
    fireEvent.change(screen.getByLabelText('Time'), {
      target: { value: '22:17' },
    })

    expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(2)
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-26')
    expect(screen.getByLabelText('Time')).toHaveValue('22:17')
    await user.click(
      screen.getByRole('button', { name: 'Enter drink manually instead' }),
    )
    expect(screen.getByLabelText('Drink type')).toBeEnabled()
    expect(screen.getByLabelText('Drink type')).toHaveValue('')
    expect(screen.getByLabelText('Drink name')).toHaveValue('')
    expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(2)
    expect(screen.getByLabelText('Date')).toHaveValue('2026-08-26')
    expect(screen.getByLabelText('Time')).toHaveValue('22:17')
  })

  it('creates an independent history snapshot without changing the saved drink', async () => {
    await storeSavedDrinks([savedCarltonDraught])
    await new IndexedDbDrinkingRecordRepository().add(existingRecord)
    const user = userEvent.setup()
    await renderHydratedPage()

    await user.click(
      screen.getByRole('button', {
        name: /Carlton Draught.*Beer.*375 mL.*4.6% ABV/,
      }),
    )
    fireEvent.change(screen.getByLabelText('Number of servings consumed'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-08-26' },
    })
    fireEvent.change(screen.getByLabelText('Time'), {
      target: { value: '22:17' },
    })
    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )

    expect(
      await screen.findByText('Drinking record saved on this device.'),
    ).toBeInTheDocument()
    const records = await new IndexedDbDrinkingRecordRepository().list()
    expect(records).toHaveLength(2)
    expect(records[0]).toEqual(existingRecord)
    expect(records[1]).toMatchObject({
      drinkType: 'beer',
      drinkName: 'Carlton Draught',
      servingVolumeMl: 375,
      abvPercent: 4.6,
      amountConsumed: 2,
      consumedAt: new Date(2026, 7, 26, 22, 17).toISOString(),
      consumedTimezoneOffsetMinutes: new Date(
        2026,
        7,
        26,
        22,
        17,
      ).getTimezoneOffset(),
    })
    await expect(new IndexedDbSavedDrinkRepository().list()).resolves.toEqual([
      savedCarltonDraught,
    ])

    const recentRecordsHeading = screen.getByRole('heading', {
      name: 'Recent records',
    })
    const recentRecordsSection = recentRecordsHeading.closest('section')
    expect(recentRecordsSection).not.toBeNull()
    expect(
      within(recentRecordsSection as HTMLElement).getByText(
        'Carlton Draught',
      ),
    ).toBeInTheDocument()
  })

  it('does not create history when saved-drink consumption details are invalid', async () => {
    await storeSavedDrinks([savedCarltonDraught])
    await new IndexedDbDrinkingRecordRepository().add(existingRecord)
    const user = userEvent.setup()
    await renderHydratedPage()

    await user.click(
      screen.getByRole('button', {
        name: /Carlton Draught.*Beer.*375 mL.*4.6% ABV/,
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )

    expect(
      await screen.findByText('Enter an amount greater than 0 servings.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Number of servings consumed')).toHaveFocus()
    await expect(
      new IndexedDbDrinkingRecordRepository().list(),
    ).resolves.toEqual([existingRecord])
    await expect(new IndexedDbSavedDrinkRepository().list()).resolves.toEqual([
      savedCarltonDraught,
    ])
  })

  it('does not save invalid reusable drink information', async () => {
    const user = userEvent.setup()
    await renderHydratedPage()

    await user.click(
      screen.getByRole('button', {
        name: 'Save this drink to My Drinks',
      }),
    )

    expect(
      await screen.findByText('Check the highlighted drink details before saving to My Drinks.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Select a drink type.')).toBeInTheDocument()
    expect(screen.getByLabelText('Drink type')).toHaveFocus()
    await expect(new IndexedDbSavedDrinkRepository().list()).resolves.toEqual(
      [],
    )
    await expect(
      new IndexedDbDrinkingRecordRepository().list(),
    ).resolves.toEqual([])
  })
})

describe('ManualDrinkForm saved-drink failures', () => {
  it('keeps drink details and shows an error when saved-drink storage fails', async () => {
    render(
      <ManualDrinkForm
        referenceCategories={DRINK_REFERENCE_CATEGORIES}
        referenceStatus="loaded"
        onRetryReferenceData={() => undefined}
        savedDrinks={[]}
        onSave={() => undefined}
        onSaveSavedDrink={async () => {
          throw new Error('Saved-drink storage is unavailable')
        }}
        onUpdateSavedDrink={() => undefined}
        onDeleteSavedDrink={() => undefined}
      />,
    )
    const user = await enterReusableDrinkDetails()

    await user.click(
      screen.getByRole('button', {
        name: 'Save this drink to My Drinks',
      }),
    )

    expect(
      await screen.findByText(/could not be saved to My Drinks on this device/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Drink name')).toHaveValue('  Pale Ale  ')
    expect(
      screen.queryByText('Drink saved to My Drinks on this device.'),
    ).not.toBeInTheDocument()
  })
})
