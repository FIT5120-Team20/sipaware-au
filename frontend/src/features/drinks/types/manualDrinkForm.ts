import type { DrinkType } from './drinkingRecord'

export const CUSTOM_SERVING_SIZE = 'custom'

export interface ReusableDrinkFormValues {
  drinkType: DrinkType | ''
  drinkName: string
  servingSizeSelection: string
  customVolumeMl: string
  abvPercent: string
}

export interface ManualDrinkFormValues extends ReusableDrinkFormValues {
  amountConsumed: string
  date: string
  time: string
}

export type ReusableDrinkField = keyof ReusableDrinkFormValues
export type ManualDrinkField = keyof ManualDrinkFormValues

export interface ValidatedReusableDrinkInput {
  drinkType: DrinkType
  drinkName: string
  servingVolumeMl: number
  abvPercent: number
}

export interface ValidatedManualDrinkInput
  extends ValidatedReusableDrinkInput {
  amountConsumed: number
  consumedAt: string
  consumedTimezoneOffsetMinutes: number
}

export type ReusableDrinkFormErrors = Partial<
  Record<ReusableDrinkField, string>
>

export type ManualDrinkFormErrors = Partial<
  Record<ManualDrinkField, string>
>
