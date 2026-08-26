import { describe, expect, it } from 'vitest'

import { DRINK_TYPE_CONFIG } from './drinkTypes'

describe('drink type product configuration', () => {
  it('contains the agreed serving-size defaults and custom-only Other type', () => {
    expect(DRINK_TYPE_CONFIG).toEqual([
      { value: 'beer', label: 'Beer', servingSizesMl: [285, 375, 425] },
      { value: 'wine', label: 'Wine', servingSizesMl: [100, 150] },
      { value: 'cider', label: 'Cider', servingSizesMl: [330, 375] },
      { value: 'spirits', label: 'Spirits', servingSizesMl: [30, 60] },
      { value: 'other', label: 'Other', servingSizesMl: [] },
    ])
  })
})
