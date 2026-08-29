import { describe, expect, it } from 'vitest'

import { DRINK_OPTIONS_RESPONSE } from '../../../test/drinkReferenceFixture'
import {
  DRINK_TYPE_COMPATIBILITY,
  getDrinkTypeLabel,
  isDrinkType,
  mapDrinkReferenceCategories,
} from './drinkTypes'

describe('drink type persistence compatibility', () => {
  it('keeps legacy values and adds stable identifiers for new categories', () => {
    expect(DRINK_TYPE_COMPATIBILITY.map((item) => item.value)).toEqual([
      'beer',
      'wine',
      'cider',
      'spirits',
      'rtd-premixed',
      'cocktail',
      'liqueur',
      'other',
    ])
    expect(isDrinkType('spirits')).toBe(true)
  })

  it('maps Neon identity and labels without renaming persisted spirits', () => {
    const categories = mapDrinkReferenceCategories(DRINK_OPTIONS_RESPONSE)

    expect(categories).toHaveLength(8)
    expect(categories.find((item) => item.id === 4)).toMatchObject({
      drinkType: 'spirits',
      name: 'Straight Spirits',
    })
    expect(getDrinkTypeLabel('spirits', categories)).toBe('Straight Spirits')
    expect(getDrinkTypeLabel('spirits')).toBe('Spirits')
  })
})
