/**
 * Typed HTTP boundary for public alcohol-guideline reference data.
 *
 * This bodyless GET accepts no DrinkingRecord or SavedDrink input, keeping all
 * personal consumption history inside the browser calculation boundary.
 */
import type {
  AlcoholGuidelineDto,
  AlcoholGuidelineType,
  AlcoholGuidelinesResponseDto,
} from '../features/drinks/types/alcoholGuideline'
import type { ReferenceSourceDto } from '../features/drinks/types/drinkReference'
import { buildApiUrl } from './apiBaseUrl'

const REQUIRED_GUIDELINE_TYPES = new Set<AlcoholGuidelineType>([
  'DAILY',
  'WEEKLY',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSource(value: unknown): value is ReferenceSourceDto {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.organisation) &&
    isNonEmptyString(value.url)
  )
}

function isGuidelineType(value: unknown): value is AlcoholGuidelineType {
  return (
    typeof value === 'string' &&
    REQUIRED_GUIDELINE_TYPES.has(value as AlcoholGuidelineType)
  )
}

function isGuideline(value: unknown): value is AlcoholGuidelineDto {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    isGuidelineType(value.guidelineType) &&
    isPositiveFiniteNumber(value.thresholdStandardDrinks) &&
    isNonEmptyString(value.periodDescription) &&
    isNonEmptyString(value.guidelineText) &&
    isSource(value.source)
  )
}

function isAlcoholGuidelinesResponse(
  value: unknown,
): value is AlcoholGuidelinesResponseDto {
  if (
    !isRecord(value) ||
    !Array.isArray(value.guidelines) ||
    value.guidelines.length !== REQUIRED_GUIDELINE_TYPES.size ||
    !value.guidelines.every(isGuideline)
  ) {
    return false
  }

  return (
    new Set(value.guidelines.map((guideline) => guideline.guidelineType))
      .size === REQUIRED_GUIDELINE_TYPES.size
  )
}

export async function getAlcoholGuidelines(
  signal?: AbortSignal,
): Promise<AlcoholGuidelinesResponseDto> {
  const response = await fetch(
    buildApiUrl('/api/reference/alcohol-guidelines'),
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(
      `Alcohol guideline request failed with status ${response.status}`,
    )
  }

  const payload: unknown = await response.json()
  if (!isAlcoholGuidelinesResponse(payload)) {
    throw new Error(
      'Alcohol guideline response did not match the API contract',
    )
  }

  return payload
}
