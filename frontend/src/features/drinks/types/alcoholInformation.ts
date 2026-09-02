/**
 * Public US2.3 DTOs mirror the FastAPI contract without exposing physical
 * Neon identifiers for topics or accepting any browser-local personal data.
 */
import type { AlcoholInformationTopicCode } from './alcoholGuideline'

export type AlcoholInformationContentType =
  | 'PROJECT_SUMMARY'
  | 'SOURCE_EXCERPT'
  | 'LINK_ONLY'

export type AlcoholInformationSourceRole = 'PRIMARY' | 'SUPPORTING'

export interface AlcoholInformationSourceDto {
  id: number
  role: AlcoholInformationSourceRole
  name: string
  organisation: string
  url: string
}

export interface AlcoholInformationContentDto {
  id: number
  title: string
  contentType: AlcoholInformationContentType
  bodyText: string
  displayOrder: number
  lastVerified: string
  sources: AlcoholInformationSourceDto[]
}

export interface AlcoholInformationTopicDto {
  topicCode: AlcoholInformationTopicCode
  displayName: string
  displayOrder: number
  content: AlcoholInformationContentDto[]
}

export interface AlcoholInformationResponseDto {
  topics: AlcoholInformationTopicDto[]
}
