import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DrinkingRecordEditor } from '../components/DrinkingRecordEditor'
import { RecentDrinkingRecords } from '../components/RecentDrinkingRecords'
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

const skyRecord: DrinkingRecord = {
  id: 'sky-record',
  drinkType: 'beer',
  drinkName: 'Sky',
  servingVolumeMl: 300,
  abvPercent: 4,
  amountConsumed: 2,
  consumedAt: '2026-08-27T03:17:00.000Z',
  consumedTimezoneOffsetMinutes: 300,
  createdAt: '2026-08-27T03:18:00.000Z',
}

const shirazRecord: DrinkingRecord = {
  id: 'shiraz-record',
  drinkType: 'wine',
  drinkName: 'Shiraz',
  servingVolumeMl: 150,
  abvPercent: 13.5,
  amountConsumed: 1,
  consumedAt: '2026-08-25T09:30:00.000Z',
  consumedTimezoneOffsetMinutes: 0,
  createdAt: '2026-08-25T09:31:00.000Z',
}

function storeRecords(records: readonly DrinkingRecord[]) {
  window.localStorage.setItem(
    DRINKING_RECORDS_STORAGE_KEY,
    JSON.stringify(records),
  )
}

function storeSavedDrinks(savedDrinks: readonly SavedDrink[]) {
  window.localStorage.setItem(
    SAVED_DRINKS_STORAGE_KEY,
    JSON.stringify(savedDrinks),
  )
}

function readRecords(): DrinkingRecord[] {
  return JSON.parse(
    window.localStorage.getItem(DRINKING_RECORDS_STORAGE_KEY) ?? '[]',
  ) as DrinkingRecord[]
}

function readSavedDrinks(): SavedDrink[] {
  return JSON.parse(
    window.localStorage.getItem(SAVED_DRINKS_STORAGE_KEY) ?? '[]',
  ) as SavedDrink[]
}

function getRecentRecordsSection(): HTMLElement {
  const heading = screen.getByRole('heading', { name: 'Recent records' })
  const section = heading.closest('section')
  if (!(section instanceof HTMLElement)) {
    throw new Error('Expected the Recent records section.')
  }
  return section
}

function getRecordEditor(): HTMLFormElement {
  const heading = screen.getByRole('heading', {
    name: 'Edit drinking record',
  })
  const editor = heading.closest('form')
  if (!(editor instanceof HTMLFormElement)) {
    throw new Error('Expected a drinking-record edit form.')
  }
  return editor
}

describe('ManualDrinkPage drinking-record management', () => {
  it('shows complete record information and loads the original wall-clock values', async () => {
    storeRecords([skyRecord])
    const user = userEvent.setup()
    render(<ManualDrinkPage />)
    const recentRecords = getRecentRecordsSection()

    expect(within(recentRecords).getByText('Sky')).toBeInTheDocument()
    expect(within(recentRecords).getByText('Beer')).toBeInTheDocument()
    expect(within(recentRecords).getByText('300 mL')).toBeInTheDocument()
    expect(within(recentRecords).getByText('4%')).toBeInTheDocument()
    expect(within(recentRecords).getByText('2')).toBeInTheDocument()
    expect(
      within(recentRecords).getByText('26 Aug 2026, 10:17 pm'),
    ).toBeInTheDocument()
    expect(
      within(recentRecords).queryByText(/[\u5e74\u6708\u65e5]/),
    ).not.toBeInTheDocument()

    await user.click(
      within(recentRecords).getByRole('button', {
        name: 'Edit drinking record for Sky',
      }),
    )
    const editor = getRecordEditor()

    expect(within(editor).getByLabelText('Drink type')).toHaveValue('beer')
    expect(within(editor).getByLabelText('Drink name')).toHaveValue('Sky')
    expect(within(editor).getByLabelText('Serving size / volume')).toHaveValue(
      'custom',
    )
    expect(within(editor).getByLabelText('Custom volume (mL)')).toHaveValue(300)
    expect(within(editor).getByLabelText('ABV (%)')).toHaveValue(4)
    expect(
      within(editor).getByLabelText('Number of servings consumed'),
    ).toHaveValue(2)
    expect(within(editor).getByLabelText('Date')).toHaveValue('2026-08-26')
    expect(within(editor).getByLabelText('Time')).toHaveValue('22:17')
    expect(
      within(editor).getByText(/correcting a past drinking record/i),
    ).toBeInTheDocument()
    expect(within(editor).getByText(/My Drinks will not be changed/i)).toBeInTheDocument()
  })

  it('corrects a record created from My Drinks without changing its saved drink', async () => {
    storeRecords([shirazRecord])
    storeSavedDrinks([savedSky])
    const user = userEvent.setup()
    const view = render(<ManualDrinkPage />)

    await user.click(
      screen.getByRole('button', {
        name: /Sky.*Beer.*300 mL.*4% ABV/,
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
    const createdSkyRecord = readRecords()[1]
    expect(createdSkyRecord).toMatchObject({
      drinkType: 'beer',
      drinkName: 'Sky',
      servingVolumeMl: 300,
      abvPercent: 4,
      amountConsumed: 2,
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Edit drinking record for Sky',
      }),
    )
    const editor = getRecordEditor()
    fireEvent.change(within(editor).getByLabelText('Drink name'), {
      target: { value: '  Sky Test  ' },
    })
    fireEvent.change(within(editor).getByLabelText('Custom volume (mL)'), {
      target: { value: '500' },
    })
    fireEvent.change(within(editor).getByLabelText('ABV (%)'), {
      target: { value: '4.5' },
    })
    fireEvent.change(
      within(editor).getByLabelText('Number of servings consumed'),
      { target: { value: '1' } },
    )
    fireEvent.change(within(editor).getByLabelText('Date'), {
      target: { value: '2026-08-25' },
    })
    fireEvent.change(within(editor).getByLabelText('Time'), {
      target: { value: '22:29' },
    })
    await user.click(
      within(editor).getByRole('button', { name: 'Save changes' }),
    )

    expect(
      await screen.findByText(
        'The drinking record for Sky Test was updated.',
      ),
    ).toBeInTheDocument()
    const records = readRecords()
    expect(records).toHaveLength(2)
    expect(records[0]).toEqual(shirazRecord)
    expect(records[1]).toEqual({
      ...createdSkyRecord,
      drinkName: 'Sky Test',
      servingVolumeMl: 500,
      abvPercent: 4.5,
      amountConsumed: 1,
      consumedAt: new Date(2026, 7, 25, 22, 29).toISOString(),
      consumedTimezoneOffsetMinutes: new Date(
        2026,
        7,
        25,
        22,
        29,
      ).getTimezoneOffset(),
    })
    expect(records[1].id).toBe(createdSkyRecord.id)
    expect(records[1].createdAt).toBe(createdSkyRecord.createdAt)
    expect(readSavedDrinks()).toEqual([savedSky])

    const recentRecords = getRecentRecordsSection()
    expect(within(recentRecords).getByText('Sky Test')).toBeInTheDocument()
    expect(
      within(recentRecords).getByText('25 Aug 2026, 10:29 pm'),
    ).toBeInTheDocument()

    view.unmount()
    render(<ManualDrinkPage />)
    expect(
      within(getRecentRecordsSection()).getByText('Sky Test'),
    ).toBeInTheDocument()
    expect(readSavedDrinks()).toEqual([savedSky])
  })

  it('rejects an invalid correction without changing stored history or My Drinks', async () => {
    storeRecords([skyRecord])
    storeSavedDrinks([savedSky])
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.click(
      screen.getByRole('button', {
        name: 'Edit drinking record for Sky',
      }),
    )
    const editor = getRecordEditor()
    fireEvent.change(within(editor).getByLabelText('Drink name'), {
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
    expect(within(editor).getByLabelText('Drink name')).toHaveFocus()
    expect(readRecords()).toEqual([skyRecord])
    expect(readSavedDrinks()).toEqual([savedSky])
  })

  it('requires confirmation, supports cancel, and deletes only one history record', async () => {
    storeRecords([shirazRecord, skyRecord])
    storeSavedDrinks([savedSky])
    const user = userEvent.setup()
    render(<ManualDrinkPage />)

    await user.click(
      screen.getByRole('button', {
        name: 'Delete drinking record for Sky',
      }),
    )
    expect(screen.getByText('Delete this drinking record?')).toBeInTheDocument()
    expect(
      screen.getByText(/removes this record from your drinking history/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/My Drinks will not be changed/i)).toBeInTheDocument()
    expect(readRecords()).toEqual([shirazRecord, skyRecord])

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(
      screen.queryByText('Delete this drinking record?'),
    ).not.toBeInTheDocument()
    expect(readRecords()).toEqual([shirazRecord, skyRecord])

    await user.click(
      screen.getByRole('button', {
        name: 'Delete drinking record for Sky',
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Yes, delete record' }),
    )

    expect(readRecords()).toEqual([shirazRecord])
    expect(readSavedDrinks()).toEqual([savedSky])
    const recentRecords = getRecentRecordsSection()
    expect(within(recentRecords).queryByText('Sky')).not.toBeInTheDocument()
    expect(within(recentRecords).getByText('Shiraz')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Sky.*Beer.*300 mL.*4% ABV/,
      }),
    ).toBeInTheDocument()
  })
})

const invalidCorrectionCases = [
  {
    name: 'a blank drink name',
    label: 'Drink name',
    value: '   ',
    error: 'Enter a drink name.',
  },
  {
    name: 'a zero volume',
    label: 'Custom volume (mL)',
    value: '0',
    error: 'Enter a volume greater than 0 mL.',
  },
  {
    name: 'a negative volume',
    label: 'Custom volume (mL)',
    value: '-1',
    error: 'Enter a volume greater than 0 mL.',
  },
  {
    name: 'a zero ABV',
    label: 'ABV (%)',
    value: '0',
    error: 'Enter an ABV greater than 0%.',
  },
  {
    name: 'an ABV above 100',
    label: 'ABV (%)',
    value: '101',
    error: 'ABV cannot be greater than 100%.',
  },
  {
    name: 'zero servings',
    label: 'Number of servings consumed',
    value: '0',
    error: 'Enter an amount greater than 0 servings.',
  },
  {
    name: 'a missing date',
    label: 'Date',
    value: '',
    error: 'Enter the date consumed.',
  },
  {
    name: 'a missing time',
    label: 'Time',
    value: '',
    error: 'Enter the time consumed.',
  },
] as const

describe('DrinkingRecordEditor validation and failures', () => {
  it.each(invalidCorrectionCases)(
    'rejects $name and identifies the field',
    async ({ label, value, error }) => {
      const onSave = vi.fn()
      const originalRecord = { ...skyRecord }
      const user = userEvent.setup()
      render(
        <DrinkingRecordEditor
          record={skyRecord}
          onSave={onSave}
          onCancel={() => undefined}
        />,
      )

      const field = screen.getByLabelText(label)
      fireEvent.change(field, { target: { value } })
      await user.click(screen.getByRole('button', { name: 'Save changes' }))

      expect(await screen.findByText(error)).toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()
      expect(skyRecord).toEqual(originalRecord)
      await waitFor(() => expect(field).toHaveFocus())
    },
  )

  it('retains entered correction values and explains a save failure', async () => {
    const user = userEvent.setup()
    render(
      <DrinkingRecordEditor
        record={skyRecord}
        onSave={() => {
          throw new Error('Storage unavailable')
        }}
        onCancel={() => undefined}
      />,
    )

    fireEvent.change(screen.getByLabelText('Drink name'), {
      target: { value: 'Sky Test' },
    })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText(/could not be saved on this device/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Drink name')).toHaveValue('Sky Test')
  })
})

describe('RecentDrinkingRecords deletion failures', () => {
  it('keeps the record visible and explains when deletion fails', async () => {
    const user = userEvent.setup()
    render(
      <RecentDrinkingRecords
        records={[skyRecord]}
        onUpdate={() => undefined}
        onDelete={() => {
          throw new Error('Storage unavailable')
        }}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Delete drinking record for Sky',
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Yes, delete record' }),
    )

    expect(
      await screen.findByText(/could not be deleted on this device/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Sky')).toBeInTheDocument()
  })
})
