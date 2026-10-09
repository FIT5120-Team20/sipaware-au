import { describe, expect, it } from 'vitest'
import { AWARDS, calculateAwards, type AwardId, type AwardInput } from '../../../frontend/src/features/awards/awardRules'

const now = new Date(2026, 9, 8, 23, 59)
const stamp = (day: number) => new Date(2026, 8, day, 12).toISOString()
const noAlcohol = (day: number, createdDay = 30) => ({
  id: `day:2026-09-${String(day).padStart(2, '0')}`, kind: 'alcohol-free',
  date: `2026-09-${String(day).padStart(2, '0')}`, confirmedAt: stamp(createdDay),
})
const drink = (day: number, createdDay = 30) => ({
  id: `drink-${day}`, drinkType: 'beer', drinkName: 'Test drink',
  servingVolumeMl: 375, amountConsumed: 1, abvPercent: 5,
  consumedAt: stamp(day), consumedTimezoneOffsetMinutes: new Date(stamp(day)).getTimezoneOffset(),
  createdAt: stamp(createdDay),
})
function evaluate(overrides: Partial<AwardInput> = {}) {
  return calculateAwards({ records: [], checkIns: [], earnedIds: [], now, ...overrides })
}
function award(id: AwardId, overrides: Partial<AwardInput> = {}) {
  return evaluate(overrides).find(row => row.id === id)!
}

describe('Epic 6 award rules', () => {
  it('lists the six awards and does not interpret missing dates as alcohol-free', () => {
    expect(AWARDS).toHaveLength(6)
    expect(evaluate().every(row => row.status === 'not-earned' && row.progress === 0)).toBe(true)
  })
  it.each([{ records: [drink(1)] }, { checkIns: [noAlcohol(1)] }])('recognises either kind of first check-in: %j', input => {
    expect(award('small-step', input).newlyEarned).toBe(true)
  })
  it('counts seven backfilled dates created today as one engagement day', () => {
    const checkIns = Array.from({ length: 7 }, (_, i) => noAlcohol(i + 1))
    expect(award('keeping-track', { checkIns }).progress).toBe(1)
    expect(award('alcohol-free-progress', { checkIns }).status).toBe('earned')
  })
  it('deduplicates drink and No alcohol creation dates across stores', () => {
    expect(award('keeping-track', { records: [drink(1)], checkIns: [noAlcohol(2)] }).progress).toBe(1)
  })
  it.each([['keeping-track', 7], ['building-a-habit', 14]] as const)('earns %s on nonconsecutive creation dates', (id, count) => {
    const checkIns = Array.from({ length: count }, (_, i) => noAlcohol(i * 2 + 1, i * 2 + 1))
    expect(award(id, { checkIns }).status).toBe('earned')
    expect(award(id, { checkIns: checkIns.slice(1) }).status).toBe('in-progress')
  })
  it('excludes alcohol-free metadata when any positive drink exists, even if display rounds to zero', () => {
    const records = [{ ...drink(1), amountConsumed: 0.00001 }]
    expect(award('alcohol-free-start', { records, checkIns: [noAlcohol(1)] }).progress).toBe(0)
  })
  it('recalculates unearned progress but never revokes a previously earned award', () => {
    expect(award('alcohol-free-progress', { checkIns: [noAlcohol(1), noAlcohol(2)] }).progress).toBe(2)
    expect(award('alcohol-free-progress', { checkIns: [noAlcohol(1)] }).progress).toBe(1)
    expect(award('alcohol-free-progress', { earnedIds: ['alcohol-free-progress'] })).toMatchObject({ status: 'earned', progress: 5, newlyEarned: false })
  })
  it('ignores duplicate dates, tracking metadata, malformed rows and future data', () => {
    const checkIns = [noAlcohol(1), noAlcohol(1), { kind: 'tracking-start', id: 'tracking-start', date: '2026-09-01' }, null,
      { ...noAlcohol(2), confirmedAt: '2099-01-01T00:00:00.000Z' },
      { id: 'day:2099-01-01', kind: 'alcohol-free', date: '2099-01-01', confirmedAt: stamp(30) }]
    expect(award('alcohol-free-progress', { checkIns, records: [{ ...drink(1), abvPercent: -1 }] }).progress).toBe(1)
  })
  it('requires both an approved history threshold and actually viewing Trends', () => {
    const checkIns = Array.from({ length: 7 }, (_, i) => noAlcohol(i + 1))
    expect(award('know-your-patterns', { checkIns, viewedTrends: true }).status).toBe('not-earned')
    expect(award('know-your-patterns', { checkIns, trendsMinimumDays: 7 }).status).toBe('not-earned')
    expect(award('know-your-patterns', { checkIns: checkIns.slice(1), trendsMinimumDays: 7, viewedTrends: true }).status).toBe('not-earned')
    expect(award('know-your-patterns', { checkIns, trendsMinimumDays: 7, viewedTrends: true }).status).toBe('earned')
  })
  it('does not mutate the supplied history or previously earned list', () => {
    const input = { records: [drink(1)], checkIns: [noAlcohol(2)], earnedIds: [] as AwardId[], now }
    const before = JSON.stringify(input)
    calculateAwards(input)
    expect(JSON.stringify(input)).toBe(before)
  })
})

describe('award regression boundaries', () => {
  it('does not let stale No alcohol metadata inflate engagement before reconciliation', () => {
    const result = award('keeping-track', { records: [drink(1, 2)], checkIns: [noAlcohol(1, 3)] })
    expect(result.progress).toBe(1)
  })
  it('grants the alcohol-free award exactly on the fifth distinct date', () => {
    const four = Array.from({ length: 4 }, (_, i) => noAlcohol(i + 1))
    expect(award('alcohol-free-progress', { checkIns: four })).toMatchObject({ progress: 4, status: 'in-progress' })
    expect(award('alcohol-free-progress', { checkIns: [...four, noAlcohol(4)] }).progress).toBe(4)
    expect(award('alcohol-free-progress', { checkIns: [...four, noAlcohol(5)] }).newlyEarned).toBe(true)
  })
  it('does not award engagement for more drinks on the same creation date', () => {
    const records = Array.from({ length: 14 }, (_, i) => ({ ...drink(i + 1), amountConsumed: 20 }))
    expect(award('keeping-track', { records }).progress).toBe(1)
    expect(award('building-a-habit', { records }).progress).toBe(1)
  })
  it('ignores future drink dates and future creation timestamps', () => {
    const records = [{ ...drink(1), consumedAt: '2099-01-01T12:00:00.000Z' },
      { ...drink(2), createdAt: '2099-01-01T12:00:00.000Z' }]
    expect(award('small-step', { records }).status).toBe('not-earned')
  })
  it('uses the stored consumption offset to match a drink to its represented date', () => {
    const record = { ...drink(1), consumedAt: '2026-09-01T23:30:00.000Z', consumedTimezoneOffsetMinutes: -600 }
    expect(award('alcohol-free-start', { records: [record], checkIns: [noAlcohol(2)] }).progress).toBe(0)
  })
  it('uses local creation dates across midnight, separately from represented dates', () => {
    const records = [
      { ...drink(1), createdAt: new Date(2026, 8, 20, 23, 59).toISOString() },
      { ...drink(2), createdAt: new Date(2026, 8, 21, 0, 1).toISOString() },
    ]
    expect(award('keeping-track', { records }).progress).toBe(2)
  })
  it.each([0, -1, 1.5, NaN, Infinity])('does not enable Trends awards with invalid threshold %s', trendsMinimumDays => {
    expect(award('know-your-patterns', { checkIns: [noAlcohol(1)], viewedTrends: true, trendsMinimumDays }).status).toBe('not-earned')
  })
  it('rejects an invalid current time instead of generating misleading progress', () => {
    expect(() => evaluate({ now: new Date('invalid') })).toThrow('A valid current time is required.')
  })
  it('does not announce an already earned award again when its condition still holds', () => {
    expect(award('small-step', { checkIns: [noAlcohol(1)], earnedIds: ['small-step'] })).toMatchObject({ status: 'earned', newlyEarned: false })
  })
})
