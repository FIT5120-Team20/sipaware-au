import { isDrinkType } from '../config/drinkTypes'
import type { SavedDrink } from '../types/savedDrink'

export const SAVED_DRINKS_STORAGE_KEY = 'sipaware.savedDrinks.v1'

export interface SavedDrinkRepository {
  list(): SavedDrink[]
  add(savedDrink: SavedDrink): SavedDrink[]
  update(savedDrink: SavedDrink): SavedDrink[]
  delete(savedDrinkId: string): SavedDrink[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const parsedDate = new Date(value)
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString() === value
}

export function isSavedDrink(value: unknown): value is SavedDrink {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    isNonEmptyString(candidate.id) &&
    isDrinkType(candidate.drinkType) &&
    isNonEmptyString(candidate.drinkName) &&
    isPositiveFiniteNumber(candidate.servingVolumeMl) &&
    isPositiveFiniteNumber(candidate.abvPercent) &&
    candidate.abvPercent <= 100 &&
    isIsoTimestamp(candidate.createdAt) &&
    isIsoTimestamp(candidate.updatedAt)
  )
}

function parseStoredSavedDrinks(storedValue: string | null): SavedDrink[] {
  if (storedValue === null) {
    return []
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue)
    return Array.isArray(parsedValue)
      ? parsedValue.filter(isSavedDrink)
      : []
  } catch {
    return []
  }
}

export class LocalStorageSavedDrinkRepository
  implements SavedDrinkRepository
{
  constructor(
    private readonly storage: Storage | undefined = undefined,
    private readonly storageKey: string = SAVED_DRINKS_STORAGE_KEY,
  ) {}

  private resolveStorage(): Storage {
    return this.storage ?? window.localStorage
  }

  private readFrom(storage: Storage): SavedDrink[] {
    return parseStoredSavedDrinks(storage.getItem(this.storageKey))
  }

  list(): SavedDrink[] {
    try {
      return this.readFrom(this.resolveStorage())
    } catch {
      return []
    }
  }

  add(savedDrink: SavedDrink): SavedDrink[] {
    if (!isSavedDrink(savedDrink)) {
      throw new Error('Cannot save an invalid saved drink.')
    }

    const storage = this.resolveStorage()
    const savedDrinks = [...this.readFrom(storage), savedDrink]
    storage.setItem(this.storageKey, JSON.stringify(savedDrinks))
    return savedDrinks
  }

  update(savedDrink: SavedDrink): SavedDrink[] {
    if (!isSavedDrink(savedDrink)) {
      throw new Error('Cannot update an invalid saved drink.')
    }

    const storage = this.resolveStorage()
    const savedDrinks = this.readFrom(storage)
    const existingSavedDrink = savedDrinks.find(
      (candidate) => candidate.id === savedDrink.id,
    )

    if (!existingSavedDrink) {
      throw new Error('The saved drink no longer exists.')
    }

    if (savedDrink.createdAt !== existingSavedDrink.createdAt) {
      throw new Error('A saved drink creation time cannot be changed.')
    }

    if (
      new Date(savedDrink.updatedAt).getTime() <=
      new Date(existingSavedDrink.updatedAt).getTime()
    ) {
      throw new Error('A saved drink update time must move forward.')
    }

    const updatedSavedDrinks = savedDrinks.map((candidate) =>
      candidate.id === savedDrink.id ? savedDrink : candidate,
    )
    storage.setItem(this.storageKey, JSON.stringify(updatedSavedDrinks))
    return updatedSavedDrinks
  }

  delete(savedDrinkId: string): SavedDrink[] {
    if (!isNonEmptyString(savedDrinkId)) {
      throw new Error('A saved drink ID is required for deletion.')
    }

    const storage = this.resolveStorage()
    const savedDrinks = this.readFrom(storage)
    if (!savedDrinks.some((savedDrink) => savedDrink.id === savedDrinkId)) {
      throw new Error('The saved drink no longer exists.')
    }

    const remainingSavedDrinks = savedDrinks.filter(
      (savedDrink) => savedDrink.id !== savedDrinkId,
    )
    storage.setItem(this.storageKey, JSON.stringify(remainingSavedDrinks))
    return remainingSavedDrinks
  }
}
