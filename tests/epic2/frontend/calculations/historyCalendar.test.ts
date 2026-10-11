import { describe, expect, it } from 'vitest'
import { calendarMonthDates, groupHistoryRecords, historyDayStatus, type HistoryRecord } from '../../../../frontend/src/features/drinks/utils/historyCalendar'

const record = (standardDrinks: number, date = '2026-10-05'): HistoryRecord => ({ id: date, date, time: '18:00', drinkName: 'Test record', standardDrinks })

describe('saved History dates and complete calendar slots', () => {
  it('includes every date in leap, non-leap and DST months independently of tracking or saved data', () => {
    expect(calendarMonthDates(2024, 1)).toHaveLength(29)
    expect(calendarMonthDates(2026, 1)).toHaveLength(28)
    expect(calendarMonthDates(2026, 9)).toHaveLength(31)
    expect(calendarMonthDates(2026, 9).at(0)).toBe('2026-10-01')
    expect(calendarMonthDates(2026, 9).at(-1)).toBe('2026-10-31')
  })
  it('creates groups only for saved records and valid explicit confirmations, keeping drinks together', () => {
    const records = [record(1), { ...record(2), id: 'later', time: '20:00' }]
    const groups = groupHistoryRecords(records, ['2026-10-04', '2026-10-04', '2026-10-05', '2026-02-30'])
    expect(groups.map(([date]) => date)).toEqual(['2026-10-05', '2026-10-04'])
    expect(groups[0][1].map(item => item.id)).toEqual(['later', '2026-10-05'])
    expect(groups[1][1]).toEqual([])
    expect(records[0].id).toBe('2026-10-05')
    expect(groupHistoryRecords([], [])).toEqual([])
  })
  it('uses full-precision totals, including multiple drinks, at and around the actual threshold', () => {
    expect(historyDayStatus([record(3.999)], false, 4)).toBe('within')
    expect(historyDayStatus([record(4)], false, 4)).toBe('within')
    expect(historyDayStatus([record(4.001)], false, 4)).toBe('above')
    expect(historyDayStatus([record(2), record(2.001)], false, 4)).toBe('above')
    expect(historyDayStatus([record(1.5)], false, 1.5)).toBe('within')
    expect(historyDayStatus([record(1.6)], false, 1.5)).toBe('above')
  })
  it('never treats missing records as confirmed abstinence and gives saved drinking precedence', () => {
    expect(historyDayStatus([], false, 4)).toBe('unrecorded')
    expect(historyDayStatus([], true, null)).toBe('alcohol-free')
    expect(historyDayStatus([record(1)], true, 4)).toBe('within')
  })
  it.each([null, NaN, Infinity, 0, -1])('leaves drinking records unclassified when the API threshold is %s', threshold => {
    expect(historyDayStatus([record(3.999)], false, threshold)).toBeNull()
    expect(historyDayStatus([record(4)], false, threshold)).toBeNull()
    expect(historyDayStatus([record(4.001)], false, threshold)).toBeNull()
    expect(historyDayStatus([record(2), record(2.001)], false, threshold)).toBeNull()
    expect(historyDayStatus([record(1)], true, threshold)).toBeNull()
    expect(historyDayStatus([], false, threshold)).toBe('unrecorded')
    expect(historyDayStatus([], true, threshold)).toBe('alcohol-free')
  })
})
