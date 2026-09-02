/** Public guideline contracts; no personal drinking data belongs in these DTOs. */
import type { ReferenceSourceDto } from './drinkReference'

export type AlcoholGuidelineType = 'DAILY' | 'WEEKLY'

export interface AlcoholGuidelineDto {
  id: number
  guidelineType: AlcoholGuidelineType
  thresholdStandardDrinks: number
  periodDescription: string
  guidelineText: string
  source: ReferenceSourceDto
}

export interface AlcoholGuidelinesResponseDto {
  guidelines: AlcoholGuidelineDto[]
}

export type GuidelineLoadStatus = 'loading' | 'loaded' | 'failed'

/**
 * Stable Neon topic identifiers reserved for the future US2.3 destination.
 * US2.1 intentionally renders no dead navigation controls for these topics.
 */
export const ALCOHOL_INFORMATION_TOPIC_CODES = [
  'STANDARD_DRINK',
  'ALCOHOL_GUIDELINES',
  'ALCOHOL_AGEING',
] as const

export type AlcoholInformationTopicCode =
  (typeof ALCOHOL_INFORMATION_TOPIC_CODES)[number]
