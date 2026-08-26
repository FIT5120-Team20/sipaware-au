import { describe, expect, it } from 'vitest'

import {
  CUSTOM_SERVING_SIZE,
  type ManualDrinkField,
  type ManualDrinkFormValues,
  type ReusableDrinkField,
} from '../types/manualDrinkForm'
import {
  validateManualDrinkInput,
  validateReusableDrinkInput,
} from './drinkingRecordValidation'

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
