/** Protects normalisation and validation boundaries for records and reusable drinks. */

import { describe, expect, it } from 'vitest'

import {
  CUSTOM_SERVING_SIZE,
  type ManualDrinkField,
  type ManualDrinkFormValues,
  type ReusableDrinkField,
} from '../../../../frontend/src/features/drinks/types/manualDrinkForm'
import {
  validateManualDrinkInput,
  validateReusableDrinkInput,
} from '../../../../frontend/src/features/drinks/validation/drinkingRecordValidation'

function validValues(): ManualDrinkFormValues {
  return {
    drinkType: 'beer',
    drinkName: '  Pale Ale  ',
    servingSizeSelection: '375',
    customVolumeMl: '',
    abvPercent: '4.5',
    amountConsumed: '1.5',
    date: '2026-08-26',
    time: '19:30',
  }
}

describe('validateManualDrinkInput', () => {
  // Pin a local wall clock: a UTC date slice would incorrectly reject/allow
  // dates around local midnight, especially in Sydney during daylight saving.
  it.each([
    ['tomorrow', '2026-09-17', '00:00', 'date'],
    ['later today', '2026-09-16', '15:46', 'time'],
  ])('rejects %s before a record can be saved', (_label, date, time, field) => {
    const result = validateManualDrinkInput(
      { ...validValues(), date, time }, new Date(2026, 8, 16, 15, 45, 30),
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.errors).toHaveProperty(field)
  })

  it.each([
    ['current minute', '2026-09-16', '15:45'],
    ['earlier today', '2026-09-16', '00:00'],
    ['late yesterday', '2026-09-15', '23:59'],
  ])('allows %s', (_label, date, time) => {
    expect(validateManualDrinkInput(
      { ...validValues(), date, time }, new Date(2026, 8, 16, 15, 45, 30),
    ).success).toBe(true)
  })

  it('re-evaluates the boundary when midnight passes', () => {
    const values = { ...validValues(), date: '2026-09-17', time: '00:00' }
    expect(validateManualDrinkInput(values, new Date(2026, 8, 16, 23, 59, 59)).success).toBe(false)
    expect(validateManualDrinkInput(values, new Date(2026, 8, 17, 0, 0)).success).toBe(true)
  })

  it('normalises valid values and stores the selected local date and time as ISO', () => {
    const result = validateManualDrinkInput(validValues())

    expect(result.success).toBe(true)
    if (!result.success) {
      throw new Error('Expected valid manual drink values.')
    }

    expect(result.data).toEqual({
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
  })

  it.each<{
    name: string
    changes: Partial<ManualDrinkFormValues>
    errorField: ManualDrinkField
  }>([
    {
      name: 'a whitespace-only drink name',
      changes: { drinkName: '   ' },
      errorField: 'drinkName',
    },
    {
      name: 'a zero custom volume',
      changes: {
        servingSizeSelection: CUSTOM_SERVING_SIZE,
        customVolumeMl: '0',
      },
      errorField: 'customVolumeMl',
    },
    {
      name: 'a negative custom volume',
      changes: {
        servingSizeSelection: CUSTOM_SERVING_SIZE,
        customVolumeMl: '-1',
      },
      errorField: 'customVolumeMl',
    },
    {
      name: 'a non-finite custom volume',
      changes: {
        servingSizeSelection: CUSTOM_SERVING_SIZE,
        customVolumeMl: 'Infinity',
      },
      errorField: 'customVolumeMl',
    },
    {
      name: 'a zero ABV',
      changes: { abvPercent: '0' },
      errorField: 'abvPercent',
    },
    {
      name: 'an ABV over 100',
      changes: { abvPercent: '101' },
      errorField: 'abvPercent',
    },
    {
      name: 'a zero amount consumed',
      changes: { amountConsumed: '0' },
      errorField: 'amountConsumed',
    },
    {
      name: 'an invalid calendar date',
      changes: { date: '2026-02-31' },
      errorField: 'date',
    },
    {
      name: 'an invalid time',
      changes: { time: '24:00' },
      errorField: 'time',
    },
  ])('rejects $name', ({ changes, errorField }) => {
    const result = validateManualDrinkInput({ ...validValues(), ...changes })

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error('Expected invalid manual drink values.')
    }

    expect(result.errors[errorField]).toBeDefined()
  })
})

describe('validateReusableDrinkInput', () => {
  it('normalises only the reusable drink information', () => {
    const result = validateReusableDrinkInput(validValues())

    expect(result).toEqual({
      success: true,
      data: {
        drinkType: 'beer',
        drinkName: 'Pale Ale',
        servingVolumeMl: 375,
        abvPercent: 4.5,
      },
    })
  })

  it.each<{
    name: string
    changes: Partial<ManualDrinkFormValues>
    errorField: ReusableDrinkField
  }>([
    {
      name: 'an unsupported drink type',
      changes: { drinkType: '' },
      errorField: 'drinkType',
    },
    {
      name: 'an empty drink name',
      changes: { drinkName: '   ' },
      errorField: 'drinkName',
    },
    {
      name: 'an invalid custom volume',
      changes: {
        servingSizeSelection: CUSTOM_SERVING_SIZE,
        customVolumeMl: '0',
      },
      errorField: 'customVolumeMl',
    },
    {
      name: 'an invalid ABV',
      changes: { abvPercent: '101' },
      errorField: 'abvPercent',
    },
  ])('rejects $name', ({ changes, errorField }) => {
    const result = validateReusableDrinkInput({
      ...validValues(),
      ...changes,
    })

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error('Expected invalid reusable drink values.')
    }

    expect(result.errors[errorField]).toBeDefined()
  })
})


it.each(['26.6667', '27', '999999'])('rejects an occasion above the volume-derived limit: %s', amountConsumed => {
  const result = validateManualDrinkInput({ ...validValues(), amountConsumed })
  expect(result.success).toBe(false)
  if (!result.success) expect(result.errors.amountConsumed).toMatch(/Check the amount you entered and try again/)
})
it.each(['0.1', '9.999', '10'])('accepts positive occasion amounts through the boundary: %s', amountConsumed => {
  expect(validateManualDrinkInput({ ...validValues(), amountConsumed }).success).toBe(true)
})

it('enforces the alcohol-derived limit as well as the volume limit', () => {
  const values = {...validValues(), servingSizeSelection:CUSTOM_SERVING_SIZE, customVolumeMl:'700', abvPercent:'40'}
  expect(validateManualDrinkInput({...values, amountConsumed:'2'}).success).toBe(true)
  expect(validateManualDrinkInput({...values, amountConsumed:'2.3'}).success).toBe(false)
})
