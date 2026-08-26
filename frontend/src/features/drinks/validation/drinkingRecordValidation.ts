import { getDrinkTypeConfig, isDrinkType } from '../config/drinkTypes'
import type { DrinkType } from '../types/drinkingRecord'
import {
  CUSTOM_SERVING_SIZE,
  type ManualDrinkFormErrors,
  type ManualDrinkFormValues,
  type ValidatedManualDrinkInput,
} from '../types/manualDrinkForm'

export type ManualDrinkValidationResult =
  | {
      success: true
      data: ValidatedManualDrinkInput
    }
  | {
      success: false
      errors: ManualDrinkFormErrors
    }

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

function parseFiniteNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : undefined
}

function parseDateParts(value: string): readonly [number, number, number] | null {
  const match = DATE_PATTERN.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(0)
  candidate.setHours(0, 0, 0, 0)
  candidate.setFullYear(year, month - 1, day)

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null
  }

  return [year, month, day]
}

function parseTimeParts(value: string): readonly [number, number] | null {
  const match = TIME_PATTERN.exec(value)
  if (!match) {
    return null
  }

  return [Number(match[1]), Number(match[2])]
}

export function buildConsumedAtIso(date: string, time: string): string | null {
  const dateParts = parseDateParts(date)
  const timeParts = parseTimeParts(time)
  if (!dateParts || !timeParts) {
    return null
  }

  const [year, month, day] = dateParts
  const [hours, minutes] = timeParts
  const consumedAt = new Date(0)
  consumedAt.setHours(0, 0, 0, 0)
  consumedAt.setFullYear(year, month - 1, day)
  consumedAt.setHours(hours, minutes, 0, 0)

  if (
    consumedAt.getFullYear() !== year ||
    consumedAt.getMonth() !== month - 1 ||
    consumedAt.getDate() !== day ||
    consumedAt.getHours() !== hours ||
    consumedAt.getMinutes() !== minutes
  ) {
    return null
  }

  return consumedAt.toISOString()
}

export function validateManualDrinkInput(
  values: ManualDrinkFormValues,
): ManualDrinkValidationResult {
  const errors: ManualDrinkFormErrors = {}
  let drinkType: DrinkType | undefined

  if (!isDrinkType(values.drinkType)) {
    errors.drinkType = 'Select a drink type.'
  } else {
    drinkType = values.drinkType
  }

  const drinkName = values.drinkName.trim()
  if (!drinkName) {
    errors.drinkName = 'Enter a drink name.'
  }

  let servingVolumeMl: number | undefined
  if (drinkType) {
    const drinkTypeConfig = getDrinkTypeConfig(drinkType)

    if (values.servingSizeSelection === CUSTOM_SERVING_SIZE) {
      const customVolumeMl = parseFiniteNumber(values.customVolumeMl)
      if (customVolumeMl === undefined || customVolumeMl <= 0) {
        errors.customVolumeMl = 'Enter a volume greater than 0 mL.'
      } else {
        servingVolumeMl = customVolumeMl
      }
    } else if (!values.servingSizeSelection) {
      errors.servingSizeSelection = 'Select a serving size.'
    } else {
      const selectedVolumeMl = parseFiniteNumber(values.servingSizeSelection)
      if (
        selectedVolumeMl === undefined ||
        !drinkTypeConfig?.servingSizesMl.includes(selectedVolumeMl)
      ) {
        errors.servingSizeSelection = 'Select a valid serving size.'
      } else {
        servingVolumeMl = selectedVolumeMl
      }
    }
  }

  const abvPercent = parseFiniteNumber(values.abvPercent)
  if (abvPercent === undefined || abvPercent <= 0) {
    errors.abvPercent = 'Enter an ABV greater than 0%.'
  } else if (abvPercent > 100) {
    errors.abvPercent = 'ABV cannot be greater than 100%.'
  }

  const amountConsumed = parseFiniteNumber(values.amountConsumed)
  if (amountConsumed === undefined || amountConsumed <= 0) {
    errors.amountConsumed = 'Enter an amount greater than 0 servings.'
  }

  const dateParts = parseDateParts(values.date)
  if (!values.date) {
    errors.date = 'Enter the date consumed.'
  } else if (!dateParts) {
    errors.date = 'Enter a valid date.'
  }

  const timeParts = parseTimeParts(values.time)
  if (!values.time) {
    errors.time = 'Enter the time consumed.'
  } else if (!timeParts) {
    errors.time = 'Enter a valid time.'
  }

  const consumedAt = buildConsumedAtIso(values.date, values.time)
  const consumedTimezoneOffsetMinutes = consumedAt
    ? new Date(consumedAt).getTimezoneOffset()
    : undefined
  if (dateParts && timeParts && !consumedAt) {
    errors.time = 'Enter a valid local date and time.'
  }

  if (
    Object.keys(errors).length > 0 ||
    !drinkType ||
    servingVolumeMl === undefined ||
    abvPercent === undefined ||
    amountConsumed === undefined ||
    consumedTimezoneOffsetMinutes === undefined ||
    !consumedAt
  ) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      drinkType,
      drinkName,
      servingVolumeMl,
      abvPercent,
      amountConsumed,
      consumedAt,
      consumedTimezoneOffsetMinutes,
    },
  }
}
