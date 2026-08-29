import type { DrinkType } from './drinkingRecord'

/**
 * Reusable drink template containing only attributes shared across occasions.
 * It has no consumption date, serving count, or link to DrinkingRecord, so
 * editing or deleting it cannot retroactively change historical snapshots.
 */
export interface SavedDrink {
  id: string
  drinkType: DrinkType
  drinkName: string
  servingVolumeMl: number
  abvPercent: number
  createdAt: string
  updatedAt: string
}

export type NewSavedDrink = Omit<
  SavedDrink,
  'id' | 'createdAt' | 'updatedAt'
>

let fallbackIdSequence = 0

function createSavedDrinkId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  fallbackIdSequence += 1
  return `${Date.now().toString(36)}-saved-${fallbackIdSequence.toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createSavedDrink(values: NewSavedDrink): SavedDrink {
  const timestamp = new Date().toISOString()

  return {
    id: createSavedDrinkId(),
    ...values,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/**
 * Update template fields while preserving identity and creation metadata.
 * updatedAt always moves forward so the repository can enforce monotonic
 * update metadata.
 */
export function createUpdatedSavedDrink(
  savedDrink: SavedDrink,
  values: NewSavedDrink,
): SavedDrink {
  const previousUpdatedAtMilliseconds = new Date(savedDrink.updatedAt).getTime()
  const updatedAtMilliseconds = Math.max(
    Date.now(),
    previousUpdatedAtMilliseconds + 1,
  )

  return {
    ...savedDrink,
    ...values,
    updatedAt: new Date(updatedAtMilliseconds).toISOString(),
  }
}
