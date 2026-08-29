/** Typed client for the public Epic 1 drink-reference endpoint. */

import type {
  AbvOptionDto,
  DrinkCategoryDto,
  DrinkOptionsResponseDto,
  DrinkVariantDto,
  ReferenceSourceDto,
  ServingSizeDto,
} from '../features/drinks/types/drinkReference'
import { buildApiUrl } from './apiBaseUrl'

const REFERENCE_LEVELS = new Set(['SUBTYPE', 'GENERAL', 'FALLBACK'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
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

function isVariant(value: unknown): value is DrinkVariantDto {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    isNonEmptyString(value.name)
  )
}

function hasVariantScope(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value)
}

function isServingSize(value: unknown): value is ServingSizeDto {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    isNonEmptyString(value.name) &&
    typeof value.volumeMl === 'number' &&
    Number.isFinite(value.volumeMl) &&
    value.volumeMl > 0 &&
    hasVariantScope(value.variantId) &&
    isSource(value.source)
  )
}

function isAbvOption(value: unknown): value is AbvOptionDto {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    typeof value.abvPercent === 'number' &&
    Number.isFinite(value.abvPercent) &&
    value.abvPercent > 0 &&
    value.abvPercent <= 100 &&
    typeof value.referenceLevel === 'string' &&
    REFERENCE_LEVELS.has(value.referenceLevel) &&
    isNonEmptyString(value.referenceOption) &&
    hasVariantScope(value.variantId) &&
    isNonEmptyString(value.applicationTreatment) &&
    isSource(value.source)
  )
}

function isCategory(value: unknown): value is DrinkCategoryDto {
  return (
    isRecord(value) &&
    isPositiveInteger(value.id) &&
    isNonEmptyString(value.name) &&
    Array.isArray(value.variants) &&
    value.variants.every(isVariant) &&
    Array.isArray(value.servingSizes) &&
    value.servingSizes.every(isServingSize) &&
    Array.isArray(value.abvOptions) &&
    value.abvOptions.every(isAbvOption)
  )
}

function isDrinkOptionsResponse(
  value: unknown,
): value is DrinkOptionsResponseDto {
  return (
    isRecord(value) &&
    Array.isArray(value.categories) &&
    value.categories.every(isCategory)
  )
}

/**
 * Request only public reference data. No personal IndexedDB object is accepted
 * by this function, and the GET request intentionally carries no body.
 */
export async function getDrinkOptions(
  signal?: AbortSignal,
): Promise<DrinkOptionsResponseDto> {
  const response = await fetch(buildApiUrl('/api/reference/drink-options'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'omit',
    signal,
  })

  if (!response.ok) {
    throw new Error(
      `Drink reference request failed with status ${response.status}`,
    )
  }

  const payload: unknown = await response.json()
  if (!isDrinkOptionsResponse(payload)) {
    throw new Error('Drink reference response did not match the API contract')
  }

  return payload
}
