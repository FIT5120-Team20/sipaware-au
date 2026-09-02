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
 * Stable Neon topic identifiers form one shared API, section-ID, and link
 * contract, preventing navigation targets from drifting from verified data.
 */
export const ALCOHOL_INFORMATION_TOPIC_CODES = [
  'STANDARD_DRINK',
  'ALCOHOL_GUIDELINES',
  'ALCOHOL_AGEING',
  'ALCOHOL_DRIVING',
  'ALCOHOL_MEDICINES',
  'ALCOHOL_LEGAL',
] as const

export type AlcoholInformationTopicCode =
  (typeof ALCOHOL_INFORMATION_TOPIC_CODES)[number]

const alcoholInformationTopicCodes = new Set<string>(
  ALCOHOL_INFORMATION_TOPIC_CODES,
)

export function isAlcoholInformationTopicCode(
  value: unknown,
): value is AlcoholInformationTopicCode {
  return (
    typeof value === 'string' && alcoholInformationTopicCodes.has(value)
  )
}
