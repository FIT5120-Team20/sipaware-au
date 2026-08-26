import type { DrinkType } from './drinkingRecord'

export const CUSTOM_SERVING_SIZE = 'custom'

export interface ManualDrinkFormValues {
  drinkType: DrinkType | ''
  drinkName: string
  servingSizeSelection: string
  customVolumeMl: string
  abvPercent: string
  amountConsumed: string
  date: string
  time: string
}

export type ManualDrinkField = keyof ManualDrinkFormValues

export interface ValidatedManualDrinkInput {
  drinkType: DrinkType
  drinkName: string
  servingVolumeMl: number
  abvPercent: number
  amountConsumed: number
  consumedAt: string
  consumedTimezoneOffsetMinutes: number
}

export type ManualDrinkFormErrors = Partial<
  Record<ManualDrinkField, string>
>
