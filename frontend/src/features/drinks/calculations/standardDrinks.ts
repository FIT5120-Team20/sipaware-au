/**
 * Pure standard-drink calculations for browser-local DrinkingRecord data.
 *
 * Results remain derived rather than persisted so corrections to a record are
 * reflected immediately without duplicating calculation state in IndexedDB.
 */
import type { DrinkingRecord } from '../types/drinkingRecord'

const ETHANOL_DENSITY_GRAMS_PER_MILLILITRE = 0.789

type StandardDrinkInput = Pick<
  DrinkingRecord,
  'servingVolumeMl' | 'abvPercent' | 'amountConsumed'
>

/** Calculate one record without rounding any intermediate or final value. */
export function calculateStandardDrinks(record: StandardDrinkInput): number {
  // servingVolumeMl is one serving, so multiplying by amountConsumed is
  // essential before applying percentage ABV and the agreed density constant.
  const totalVolumeMl = record.servingVolumeMl * record.amountConsumed
  return (
    (totalVolumeMl * record.abvPercent *
      ETHANOL_DENSITY_GRAMS_PER_MILLILITRE) /
    1000
  )
}

/** Sum full-precision record results before any display rounding occurs. */
export function sumStandardDrinks(
  records: readonly StandardDrinkInput[],
): number {
  return records.reduce(
    (total, record) => total + calculateStandardDrinks(record),
    0,
  )
}

/** Apply the agreed one-decimal presentation only at the UI boundary. */
export function formatStandardDrinks(value: number): string {
  return value.toFixed(1)
}
