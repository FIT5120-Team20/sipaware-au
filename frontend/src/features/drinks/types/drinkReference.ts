/**
 * Frontend contracts for public drink-reference data returned by FastAPI.
 *
 * These DTOs describe the application API rather than PostgreSQL tables. They
 * contain no SavedDrink, DrinkingRecord or other browser-local personal data.
 */
import type { DrinkType } from './drinkingRecord'

export type AbvReferenceLevel = 'SUBTYPE' | 'GENERAL' | 'FALLBACK'

export interface ReferenceSourceDto {
  id: number
  name: string
  organisation: string
  url: string
}

export interface DrinkVariantDto {
  id: number
  name: string
}

export interface ServingSizeDto {
  id: number
  name: string
  volumeMl: number
  variantId: number | null
  source: ReferenceSourceDto
}

export interface AbvOptionDto {
  id: number
  abvPercent: number
  referenceLevel: AbvReferenceLevel
  referenceOption: string
  variantId: number | null
  applicationTreatment: string
  source: ReferenceSourceDto
}

export interface DrinkCategoryDto {
  id: number
  name: string
  variants: DrinkVariantDto[]
  servingSizes: ServingSizeDto[]
  abvOptions: AbvOptionDto[]
}

export interface DrinkOptionsResponseDto {
  categories: DrinkCategoryDto[]
}

/** A validated API category paired with its stable local persistence value. */
export interface DrinkReferenceCategory extends DrinkCategoryDto {
  drinkType: DrinkType
}

export type ReferenceLoadStatus = 'loading' | 'loaded' | 'failed'
