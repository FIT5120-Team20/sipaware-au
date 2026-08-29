/**
 * Converts untrusted form strings into validated Epic 1 domain values.
 *
 * Keeping parsing and business rules outside React means new records, saved
 * templates, and corrections all cross the same validation boundary before
 * they can reach a repository.
 */
import { getDrinkTypeConfig, isDrinkType } from '../config/drinkTypes'
import type { DrinkType } from '../types/drinkingRecord'
import {
  CUSTOM_SERVING_SIZE,
  type ManualDrinkFormErrors,
  type ManualDrinkFormValues,
  type ReusableDrinkFormErrors,
  type ReusableDrinkFormValues,
  type ValidatedManualDrinkInput,
  type ValidatedReusableDrinkInput,
} from '../types/manualDrinkForm'

export type ReusableDrinkValidationResult =
  | {
      success: true
      data: ValidatedReusableDrinkInput
    }
  | {
      success: false
      errors: ReusableDrinkFormErrors
    }

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

/**
 * Interpret date/time controls as the user's local wall-clock occasion.
 * validateManualDrinkInput pairs the resulting ISO instant with its timezone
 * offset so presentation can reconstruct the intended local time elsewhere.
 */
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

/**
 * Validate only attributes that can be reused for future drink occasions.
 * Consumption amount and date/time are excluded because SavedDrink is a
 * template rather than drinking history.
 */
export function validateReusableDrinkInput(
  values: ReusableDrinkFormValues,
): ReusableDrinkValidationResult {
  const errors: ReusableDrinkFormErrors = {}
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

  if (
    Object.keys(errors).length > 0 ||
    !drinkType ||
    servingVolumeMl === undefined ||
    abvPercent === undefined
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
    },
  }
}

/**
 * Extend reusable-drink validation with occasion-specific snapshot fields.
 * The serving volume is one serving's size; amountConsumed is the separate
 * number of servings the user consumed.
 */
export function validateManualDrinkInput(
  values: ManualDrinkFormValues,
): ManualDrinkValidationResult {
  const reusableDrinkResult = validateReusableDrinkInput(values)
  const errors: ManualDrinkFormErrors = reusableDrinkResult.success
    ? {}
    : { ...reusableDrinkResult.errors }

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
  // Capture the offset for this particular date, including daylight-saving
  // rules, so later formatting can preserve the entered wall-clock value.
  const consumedTimezoneOffsetMinutes = consumedAt
    ? new Date(consumedAt).getTimezoneOffset()
    : undefined
  if (dateParts && timeParts && !consumedAt) {
    errors.time = 'Enter a valid local date and time.'
  }

  if (
    !reusableDrinkResult.success ||
    Object.keys(errors).length > 0 ||
    amountConsumed === undefined ||
    consumedTimezoneOffsetMinutes === undefined ||
    !consumedAt
  ) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      ...reusableDrinkResult.data,
      amountConsumed,
      consumedAt,
      consumedTimezoneOffsetMinutes,
    },
  }
}
