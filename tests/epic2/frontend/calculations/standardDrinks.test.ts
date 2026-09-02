import { describe, expect, it } from 'vitest'

import {
  calculateStandardDrinks,
  formatStandardDrinks,
  sumStandardDrinks,
} from '../../../../frontend/src/features/drinks/calculations/standardDrinks'

describe('standard-drink calculations', () => {
  it('calculates one serving using percentage ABV and ethanol density', () => {
    expect(
      calculateStandardDrinks({
        servingVolumeMl: 375,
        abvPercent: 5,
        amountConsumed: 1,
      }),
    ).toBe(1.479375)
  })

  it.each([
    ['multiple servings', 375, 5, 2, 2.95875],
    ['decimal ABV', 150, 13.5, 1, 1.597725],
    ['decimal servings', 375, 5, 1.5, 2.2190625],
    ['custom volume', 237, 4.2, 1, 0.7853706],
  ])(
    'supports %s without premature rounding',
    (_name, servingVolumeMl, abvPercent, amountConsumed, expected) => {
      expect(
        calculateStandardDrinks({
          servingVolumeMl,
          abvPercent,
          amountConsumed,
        }),
      ).toBeCloseTo(expected, 12)
    },
  )

  it('aggregates unrounded records before formatting the total', () => {
    const records = [
      { servingVolumeMl: 100, abvPercent: 0.62, amountConsumed: 1 },
      { servingVolumeMl: 100, abvPercent: 0.62, amountConsumed: 1 },
    ]

    expect(formatStandardDrinks(calculateStandardDrinks(records[0]))).toBe(
      '0.0',
    )
    expect(formatStandardDrinks(calculateStandardDrinks(records[1]))).toBe(
      '0.0',
    )
    expect(sumStandardDrinks(records)).toBeCloseTo(0.097836, 12)
    expect(formatStandardDrinks(sumStandardDrinks(records))).toBe('0.1')
  })

  it('formats UI output to one decimal place only', () => {
    expect(formatStandardDrinks(7.649)).toBe('7.6')
    expect(formatStandardDrinks(7.65)).toBe('7.7')
  })
})
