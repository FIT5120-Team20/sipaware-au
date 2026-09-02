/**
 * Runtime-validated HTTP boundary for public alcohol information.
 *
 * This bodyless request cannot carry DrinkingRecords, calculations, or personal
 * attributes. Verified Neon content is presented only after the full nested
 * FastAPI contract, including source provenance, has passed validation.
 */
import type {
  AlcoholInformationContentDto,
  AlcoholInformationContentType,
  AlcoholInformationResponseDto,
  AlcoholInformationSourceDto,
  AlcoholInformationSourceRole,
  AlcoholInformationTopicDto,
} from '../features/drinks/types/alcoholInformation'
import {
  isAlcoholInformationTopicCode,
} from '../features/drinks/types/alcoholGuideline'
import { buildApiUrl } from './apiBaseUrl'

const CONTENT_TYPES = new Set<AlcoholInformationContentType>([
  'PROJECT_SUMMARY',
  'SOURCE_EXCERPT',
  'LINK_ONLY',
])
const SOURCE_ROLES = new Set<AlcoholInformationSourceRole>([
  'PRIMARY',
  'SUPPORTING',
])
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
    return false
  }

  const parsed = new Date(value + 'T00:00:00.000Z')
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isContentType(value: unknown): value is AlcoholInformationContentType {
  return (
    typeof value === 'string' &&
    CONTENT_TYPES.has(value as AlcoholInformationContentType)
  )
}

function isSourceRole(value: unknown): value is AlcoholInformationSourceRole {
  return (
    typeof value === 'string' &&
    SOURCE_ROLES.has(value as AlcoholInformationSourceRole)
  )
}

function isSource(
  value: unknown,
  sourceIds: Set<number>,
): value is AlcoholInformationSourceDto {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    sourceIds.has(value.id) ||
    !isSourceRole(value.role) ||
    !isNonEmptyString(value.name) ||
    !isNonEmptyString(value.organisation) ||
    !isHttpUrl(value.url)
  ) {
    return false
  }

  sourceIds.add(value.id)
  return true
}

function isContent(
  value: unknown,
  contentIds: Set<number>,
): value is AlcoholInformationContentDto {
  if (
    !isRecord(value) ||
    !isPositiveInteger(value.id) ||
    contentIds.has(value.id) ||
    !isNonEmptyString(value.title) ||
    !isContentType(value.contentType) ||
    !isNonEmptyString(value.bodyText) ||
    !isPositiveInteger(value.displayOrder) ||
    !isIsoDate(value.lastVerified) ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0
  ) {
    return false
  }

  const sourceIds = new Set<number>()
  if (!value.sources.every((source) => isSource(source, sourceIds))) {
    return false
  }

  contentIds.add(value.id)
  return true
}

function isTopic(
  value: unknown,
  topicCodes: Set<string>,
  contentIds: Set<number>,
): value is AlcoholInformationTopicDto {
  if (
    !isRecord(value) ||
    !isAlcoholInformationTopicCode(value.topicCode) ||
    topicCodes.has(value.topicCode) ||
    !isNonEmptyString(value.displayName) ||
    !isPositiveInteger(value.displayOrder) ||
    !Array.isArray(value.content) ||
    value.content.length === 0 ||
    !value.content.every((content) => isContent(content, contentIds))
  ) {
    return false
  }

  topicCodes.add(value.topicCode)
  return true
}

function isAlcoholInformationResponse(
  value: unknown,
): value is AlcoholInformationResponseDto {
  if (
    !isRecord(value) ||
    !Array.isArray(value.topics) ||
    value.topics.length === 0
  ) {
    return false
  }

  const topicCodes = new Set<string>()
  const contentIds = new Set<number>()
  return value.topics.every((topic) =>
    isTopic(topic, topicCodes, contentIds),
  )
}

export async function getAlcoholInformation(
  signal?: AbortSignal,
): Promise<AlcoholInformationResponseDto> {
  const response = await fetch(
    buildApiUrl('/api/reference/alcohol-information'),
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(
      'Alcohol information request failed with status ' + response.status,
    )
  }

  const payload: unknown = await response.json()
  if (!isAlcoholInformationResponse(payload)) {
    throw new Error(
      'Alcohol information response did not match the API contract',
    )
  }

  return payload
}
