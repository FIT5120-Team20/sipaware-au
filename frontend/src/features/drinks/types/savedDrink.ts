import type { DrinkType } from './drinkingRecord'

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
