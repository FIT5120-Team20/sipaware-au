export type DrinkType = 'beer' | 'wine' | 'cider' | 'spirits' | 'other'

/**
 * Self-contained historical snapshot of one recorded drinking occasion.
 * servingVolumeMl is the size of one serving and amountConsumed is the number
 * consumed. No SavedDrink reference is stored, protecting history from later
 * template edits/deletion and protecting templates from record corrections.
 */
export interface DrinkingRecord {
  id: string
  drinkType: DrinkType
  drinkName: string
  servingVolumeMl: number
  abvPercent: number
  amountConsumed: number
  consumedAt: string
  consumedTimezoneOffsetMinutes: number
  createdAt: string
}

export type NewDrinkingRecord = Omit<DrinkingRecord, 'id' | 'createdAt'>

let fallbackIdSequence = 0

function createRecordId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  fallbackIdSequence += 1
  return `${Date.now().toString(36)}-${fallbackIdSequence.toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function createDrinkingRecord(
  values: NewDrinkingRecord,
): DrinkingRecord {
  return {
    id: createRecordId(),
    ...values,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Correct one historical snapshot while preserving its ID and creation time.
 * The returned value remains independent of every SavedDrink template.
 */
export function createUpdatedDrinkingRecord(
  record: DrinkingRecord,
  values: NewDrinkingRecord,
): DrinkingRecord {
  return {
    ...record,
    ...values,
    id: record.id,
    createdAt: record.createdAt,
  }
}
