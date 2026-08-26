import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ManualDrinkForm } from '../components/ManualDrinkForm'
import {
  DRINKING_RECORDS_STORAGE_KEY,
} from '../storage/drinkingRecordRepository'
import type { DrinkingRecord } from '../types/drinkingRecord'
import { ManualDrinkPage } from './ManualDrinkPage'

const existingRecord: DrinkingRecord = {
  id: 'existing-record',
  drinkType: 'wine',
  drinkName: 'Existing Shiraz',
  servingVolumeMl: 150,
  abvPercent: 13,
  amountConsumed: 1,
  consumedAt: '2026-08-25T09:30:00.000Z',
  consumedTimezoneOffsetMinutes: 0,
  createdAt: '2026-08-25T09:31:00.000Z',
}

async function completeValidForm() {
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
  fireEvent.change(screen.getByLabelText('Number of servings consumed'), {
    target: { value: '1.5' },
  })
  fireEvent.change(screen.getByLabelText('Date'), {
    target: { value: '2026-08-26' },
  })
  fireEvent.change(screen.getByLabelText('Time'), {
    target: { value: '19:30' },
  })

  return user
}

describe('ManualDrinkPage', () => {
  it('provides every required drink and consumption input', () => {
    render(<ManualDrinkPage />)

    expect(screen.getByLabelText('Drink type')).toBeInTheDocument()
    expect(screen.getByLabelText('Drink name')).toBeInTheDocument()
    expect(screen.getByLabelText('Serving size / volume')).toBeInTheDocument()
    expect(screen.getByLabelText('ABV (%)')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Number of servings consumed'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Date')).toBeInTheDocument()
    expect(screen.getByLabelText('Time')).toBeInTheDocument()
    expect(
      screen.getByText(/number of servings consumed, for example 1\.5/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Save drinking record' }),
    ).toBeInTheDocument()
  })

  it('shows configured common serving sizes for the selected drink type', async () => {
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.selectOptions(screen.getByLabelText('Drink type'), 'beer')
    const servingSize = screen.getByLabelText('Serving size / volume')
    expect(
      within(servingSize).getByRole('option', { name: '285 mL' }),
    ).toBeInTheDocument()
    expect(
      within(servingSize).getByRole('option', { name: '375 mL' }),
    ).toBeInTheDocument()
    expect(
      within(servingSize).getByRole('option', { name: '425 mL' }),
    ).toBeInTheDocument()
    expect(
      within(servingSize).getByRole('option', { name: 'Custom volume' }),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Drink type'), 'wine')
    expect(
      within(servingSize).getByRole('option', { name: '100 mL' }),
    ).toBeInTheDocument()
    expect(
      within(servingSize).getByRole('option', { name: '150 mL' }),
    ).toBeInTheDocument()
    expect(
      within(servingSize).queryByRole('option', { name: '375 mL' }),
    ).not.toBeInTheDocument()
  })

  it('reveals a numeric millilitre input for a custom volume', async () => {
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.selectOptions(screen.getByLabelText('Drink type'), 'beer')
    await user.selectOptions(
      screen.getByLabelText('Serving size / volume'),
      'custom',
    )

    const customVolume = screen.getByLabelText('Custom volume (mL)')
    await user.type(customVolume, '500')
    expect(customVolume).toHaveValue(500)

    await user.selectOptions(screen.getByLabelText('Drink type'), 'other')
    expect(screen.getByLabelText('Serving size / volume')).toHaveValue('custom')
    expect(screen.getByLabelText('Custom volume (mL)')).toBeInTheDocument()
  })

  it('saves a valid custom volume in millilitres', async () => {
    render(<ManualDrinkPage />)
    const user = await completeValidForm()

    await user.selectOptions(
      screen.getByLabelText('Serving size / volume'),
      'custom',
    )
    fireEvent.change(screen.getByLabelText('Custom volume (mL)'), {
      target: { value: '500' },
    })
    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )

    const storedValue = window.localStorage.getItem(
      DRINKING_RECORDS_STORAGE_KEY,
    )
    const storedRecords = JSON.parse(storedValue ?? '[]') as DrinkingRecord[]

    expect(storedRecords).toHaveLength(1)
    expect(storedRecords[0]).toMatchObject({
      drinkType: 'beer',
      drinkName: 'Pale Ale',
      servingVolumeMl: 500,
    })
    expect(
      screen.getByText('Drinking record saved on this device.'),
    ).toBeInTheDocument()
  })

  it('saves a valid snapshot, preserves prior records, resets, and reloads it', async () => {
    window.localStorage.setItem(
      DRINKING_RECORDS_STORAGE_KEY,
      JSON.stringify([existingRecord]),
    )
    const view = render(<ManualDrinkPage />)
    const user = await completeValidForm()

    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )

    expect(
      await screen.findByText('Drinking record saved on this device.'),
    ).toBeInTheDocument()

    const storedValue = window.localStorage.getItem(
      DRINKING_RECORDS_STORAGE_KEY,
    )
    expect(storedValue).not.toBeNull()
    const storedRecords = JSON.parse(storedValue ?? '[]') as DrinkingRecord[]

    expect(storedRecords).toHaveLength(2)
    expect(storedRecords[0]).toEqual(existingRecord)
    expect(storedRecords[1]).toMatchObject({
      drinkType: 'beer',
      drinkName: 'Pale Ale',
      servingVolumeMl: 375,
      abvPercent: 4.5,
      amountConsumed: 1.5,
      consumedAt: new Date(2026, 7, 26, 19, 30).toISOString(),
      consumedTimezoneOffsetMinutes: new Date(
        2026,
        7,
        26,
        19,
        30,
      ).getTimezoneOffset(),
    })
    expect(storedRecords[1].id).not.toHaveLength(0)
    expect(Number.isNaN(Date.parse(storedRecords[1].createdAt))).toBe(false)
    expect(screen.getByLabelText('Drink name')).toHaveValue('')
    expect(screen.getByLabelText('Drink type')).toHaveValue('')
    expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(
      null,
    )
    expect(screen.getByText('Pale Ale')).toBeInTheDocument()
    expect(screen.getByText('Existing Shiraz')).toBeInTheDocument()

    view.unmount()
    render(<ManualDrinkPage />)
    expect(screen.getByText('Pale Ale')).toBeInTheDocument()
    expect(screen.getByText('Existing Shiraz')).toBeInTheDocument()
  })

  it('does not save an incomplete record and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.selectOptions(screen.getByLabelText('Drink type'), 'beer')
    await user.selectOptions(
      screen.getByLabelText('Serving size / volume'),
      '375',
    )
    fireEvent.change(screen.getByLabelText('ABV (%)'), {
      target: { value: '4.5' },
    })
    fireEvent.change(screen.getByLabelText('Number of servings consumed'), {
      target: { value: '1' },
    })

    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )

    expect(await screen.findByText(/Enter a drink name\./)).toBeInTheDocument()
    expect(screen.getByLabelText('Drink name')).toHaveFocus()
    expect(
      window.localStorage.getItem(DRINKING_RECORDS_STORAGE_KEY),
    ).toBeNull()
  })

  it('remains usable when local storage contains malformed data', () => {
    window.localStorage.setItem(DRINKING_RECORDS_STORAGE_KEY, '{not-json')

    expect(() => render(<ManualDrinkPage />)).not.toThrow()
    expect(
      screen.getByText('No drinks recorded on this device yet.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Save drinking record' }),
    ).toBeEnabled()
  })
})

describe('ManualDrinkForm save failures', () => {
  it('keeps entered values and does not claim success when persistence fails', async () => {
    render(
      <ManualDrinkForm
        savedDrinks={[]}
        onSave={() => {
          throw new Error('Storage is unavailable')
        }}
        onSaveSavedDrink={() => undefined}
        onUpdateSavedDrink={() => undefined}
        onDeleteSavedDrink={() => undefined}
      />,
    )
    const user = await completeValidForm()

    await user.click(
      screen.getByRole('button', { name: 'Save drinking record' }),
    )

    expect(
      await screen.findByText(/could not be saved on this device/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Drink name')).toHaveValue('  Pale Ale  ')
    expect(
      screen.queryByText('Drinking record saved on this device.'),
    ).not.toBeInTheDocument()
  })
})
