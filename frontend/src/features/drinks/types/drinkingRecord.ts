/**
 * Stable browser-persistence identifiers, deliberately separate from Neon
 * display labels. In particular, legacy `spirits` records remain valid even
 * though the current reference label is "Straight Spirits".
 */
export type DrinkType =
  | 'beer'
  | 'wine'
  | 'cider'
  | 'spirits'
  | 'rtd-premixed'
  | 'cocktail'
  | 'liqueur'
  | 'other'

// Optional value metadata, not a new IndexedDB store/index or migration.
// Legacy snapshots have no trustworthy origin; never guess it from drink names.
export type RecordSource = 'manual' | 'database'
export function isRecordSource(value: unknown): value is RecordSource | undefined {
  return value === undefined || value === 'manual' || value === 'database'
}

/**
 * Self-contained historical snapshot of one recorded drinking occasion.
 * servingVolumeMl is the size of one serving and amountConsumed is the number
 * consumed. No SavedDrink reference is stored, protecting history from later
 * template edits/deletion and protecting templates from record corrections.
 */
export interface DrinkingRecord {
  recordSource?: RecordSource
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
    recordSource: record.recordSource,
    // Database identity is the original local snapshot, not today's catalog.
    // Even callers outside the editor may change only the occasion fields.
    ...(record.recordSource === 'database' ? {
      drinkType: record.drinkType, drinkName: record.drinkName,
      servingVolumeMl: record.servingVolumeMl, abvPercent: record.abvPercent,
    } : {}),
    id: record.id,
    createdAt: record.createdAt,
  }
}
