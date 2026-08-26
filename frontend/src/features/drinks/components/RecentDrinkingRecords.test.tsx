import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { DrinkingRecord } from '../types/drinkingRecord'
import { RecentDrinkingRecords } from './RecentDrinkingRecords'

describe('RecentDrinkingRecords', () => {
  it('uses Australian English and preserves the originally entered local time', () => {
    const record: DrinkingRecord = {
      id: 'small-decimal-record',
      drinkType: 'other',
      drinkName: 'Tasting sample',
      servingVolumeMl: 0.0001,
      abvPercent: 0.0001,
      amountConsumed: 0.0001,
      consumedAt: '2026-08-26T09:30:00.000Z',
      consumedTimezoneOffsetMinutes: -600,
      createdAt: '2026-08-26T09:31:00.000Z',
    }
    render(<RecentDrinkingRecords records={[record]} />)

    expect(screen.getByText('0.0001 mL')).toBeInTheDocument()
    expect(screen.getByText('0.0001%')).toBeInTheDocument()
    expect(screen.getByText('0.0001')).toBeInTheDocument()
    expect(screen.getByText('26 Aug 2026, 7:30 pm')).toBeInTheDocument()
    expect(screen.queryByText(/[年月日]/)).not.toBeInTheDocument()
  })
})
