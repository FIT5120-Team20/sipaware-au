import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ManualDrinkForm } from '../components/ManualDrinkForm'
import { DRINKING_RECORDS_STORAGE_KEY } from '../storage/drinkingRecordRepository'
import { SAVED_DRINKS_STORAGE_KEY } from '../storage/savedDrinkRepository'
import type { DrinkingRecord } from '../types/drinkingRecord'
import type { SavedDrink } from '../types/savedDrink'
import { ManualDrinkPage } from './ManualDrinkPage'

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

function storeSavedDrinks(savedDrinks: readonly SavedDrink[]) {
  window.localStorage.setItem(
    SAVED_DRINKS_STORAGE_KEY,
    JSON.stringify(savedDrinks),
  )
}

describe('ManualDrinkPage saved drinks', () => {
  it('saves only reusable drink data, preserves existing data, and reloads it', async () => {
    storeSavedDrinks([existingSavedDrink])
    window.localStorage.setItem(
      DRINKING_RECORDS_STORAGE_KEY,
      JSON.stringify([existingRecord]),
    )
    const view = render(<ManualDrinkPage />)
    const user = await enterReusableDrinkDetails()

    await user.click(
      screen.getByRole('button', {
        name: 'Save this drink to My Drinks',
      }),
    )

    expect(
      await screen.findByText('Drink saved to My Drinks on this device.'),
    ).toBeInTheDocument()
    const savedDrinks = JSON.parse(
      window.localStorage.getItem(SAVED_DRINKS_STORAGE_KEY) ?? '[]',
    ) as SavedDrink[]

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
    expect(
      JSON.parse(
        window.localStorage.getItem(DRINKING_RECORDS_STORAGE_KEY) ?? '[]',
      ),
    ).toEqual([existingRecord])

    view.unmount()
    render(<ManualDrinkPage />)
    expect(
      screen.getByRole('button', { name: /Pale Ale/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Shiraz/ }),
    ).toBeInTheDocument()
  })

  it('loads a saved drink and leaves only current occasion details to enter', async () => {
    storeSavedDrinks([savedCarltonDraught])
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.click(
      screen.getByRole('button', { name: /Carlton Draught/ }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Using Carlton Draught from My Drinks. The saved details are filled in below and your saved drink will remain unchanged.',
    )
    expect(screen.getByLabelText('Drink type')).toHaveValue('beer')
    expect(screen.getByLabelText('Drink type')).toBeDisabled()
    expect(screen.getByLabelText('Drink name')).toHaveValue('Carlton Draught')
    expect(screen.getByLabelText('Drink name')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Serving size / volume')).toHaveValue('375')
    expect(screen.getByLabelText('Serving size / volume')).toBeDisabled()
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
    expect(
      screen.queryByRole('button', { name: /edit|delete/i }),
    ).not.toBeInTheDocument()

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
    storeSavedDrinks([savedCarltonDraught])
    window.localStorage.setItem(
      DRINKING_RECORDS_STORAGE_KEY,
      JSON.stringify([existingRecord]),
    )
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.click(
      screen.getByRole('button', { name: /Carlton Draught/ }),
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
    const records = JSON.parse(
      window.localStorage.getItem(DRINKING_RECORDS_STORAGE_KEY) ?? '[]',
    ) as DrinkingRecord[]
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
    expect(
      JSON.parse(
        window.localStorage.getItem(SAVED_DRINKS_STORAGE_KEY) ?? '[]',
      ),
    ).toEqual([savedCarltonDraught])

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
    storeSavedDrinks([savedCarltonDraught])
    window.localStorage.setItem(
      DRINKING_RECORDS_STORAGE_KEY,
      JSON.stringify([existingRecord]),
    )
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.click(
      screen.getByRole('button', { name: /Carlton Draught/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )

    expect(
      await screen.findByText('Enter an amount greater than 0 servings.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Number of servings consumed')).toHaveFocus()
    expect(
      JSON.parse(
        window.localStorage.getItem(DRINKING_RECORDS_STORAGE_KEY) ?? '[]',
      ),
    ).toEqual([existingRecord])
    expect(
      JSON.parse(
        window.localStorage.getItem(SAVED_DRINKS_STORAGE_KEY) ?? '[]',
      ),
    ).toEqual([savedCarltonDraught])
  })

  it('does not save invalid reusable drink information', async () => {
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

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
    expect(window.localStorage.getItem(SAVED_DRINKS_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(DRINKING_RECORDS_STORAGE_KEY)).toBeNull()
  })
})

describe('ManualDrinkForm saved-drink failures', () => {
  it('keeps drink details and shows an error when saved-drink storage fails', async () => {
    render(
      <ManualDrinkForm
        savedDrinks={[]}
        onSave={() => undefined}
        onSaveSavedDrink={() => {
          throw new Error('Saved-drink storage is unavailable')
        }}
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
