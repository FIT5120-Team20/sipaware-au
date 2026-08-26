export type DrinkType = 'beer' | 'wine' | 'cider' | 'spirits' | 'other'

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
