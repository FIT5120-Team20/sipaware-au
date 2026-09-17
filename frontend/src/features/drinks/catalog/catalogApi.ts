/** Public catalog boundary: no local templates, history or photos are sent. */
import { buildApiUrl } from '../../../services/apiBaseUrl'
import { isDrinkType } from '../config/drinkTypes'
import type { DrinkType } from '../types/drinkingRecord'
import { CUSTOM_SERVING_SIZE, type ManualDrinkFormValues } from '../types/manualDrinkForm'

export type CatalogCategory = 'all' | 'beer' | 'wine' | 'spirits' | 'cider' | 'rtd' | 'other'
export interface CatalogProduct {
  productId: string
  drinkName: string
  drinkType: DrinkType
  volumeMl: number
  abvPercent: number
  sourceName: string
  sourceUrl: string
}
export interface CatalogPage { products: CatalogProduct[]; total: number; offset: number; limit: number }
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000
const catalogCache = new Map<string, { page: CatalogPage; expiresAt: number }>()

function catalogCacheKey(category: CatalogCategory, query: string, offset: number) {
  return JSON.stringify([category, query.trim().toLowerCase(), offset])
}

export function getCachedCatalog(category: CatalogCategory, query: string, offset: number) {
  const key = catalogCacheKey(category, query, offset)
  const cached = catalogCache.get(key)

  if (!cached) return undefined

  if (cached.expiresAt <= Date.now()) {
    catalogCache.delete(key)
    return undefined
  }

  return cached.page
}

const types: Record<CatalogCategory, readonly DrinkType[]> = {
  all: ['beer', 'wine', 'spirits', 'cider', 'rtd-premixed', 'cocktail', 'liqueur', 'other'],
  beer: ['beer'], wine: ['wine'], spirits: ['spirits'], cider: ['cider'],
  rtd: ['rtd-premixed'], other: ['cocktail', 'liqueur', 'other'],
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}
function validSource(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}
export function validateCatalogProduct(value: unknown): CatalogProduct {
  if (!object(value) || !text(value.productId, 200) || !text(value.drinkName, 200) ||
      !text(value.sourceName, 300) || !validSource(value.sourceUrl) || !isDrinkType(value.drinkType) ||
      typeof value.volumeMl !== 'number' || !Number.isFinite(value.volumeMl) || value.volumeMl <= 0 || value.volumeMl > 100000 ||
      typeof value.abvPercent !== 'number' || !Number.isFinite(value.abvPercent) || value.abvPercent < 0 || value.abvPercent > 100) {
    throw new Error('Invalid catalog product')
  }
  return { productId: value.productId, drinkName: value.drinkName, drinkType: value.drinkType,
    volumeMl: value.volumeMl, abvPercent: value.abvPercent, sourceName: value.sourceName, sourceUrl: value.sourceUrl }
}
export function validateCatalogPage(value: unknown, category: CatalogCategory, offset: number): CatalogPage {
  if (!object(value) || !Array.isArray(value.products) || value.limit !== 24 || value.offset !== offset ||
      typeof value.total !== 'number' || !Number.isSafeInteger(value.total) || value.total < 0) {
    throw new Error('Invalid catalog page')
  }
  const products = value.products.map(validateCatalogProduct)
  if (products.length !== Math.min(24, Math.max(0, value.total - offset)) ||
      new Set(products.map(p => p.productId)).size !== products.length ||
      products.some(p => !types[category].includes(p.drinkType))) throw new Error('Invalid catalog page')
  return { products, total: value.total, offset, limit: 24 }
}
export async function loadCatalog(category: CatalogCategory, query: string, offset: number, signal: AbortSignal): Promise<CatalogPage> {
  signal.throwIfAborted()

  const cached = getCachedCatalog(category, query, offset)
  if (cached) return cached

  const owner = new AbortController()
  const cancel = () => owner.abort()
  signal.addEventListener('abort', cancel, { once: true })
  const timeout = setTimeout(cancel, 12000)
  try {
    const params = new URLSearchParams({ category, q: query.trim(), offset: String(offset), limit: '24' })
    const response = await fetch(buildApiUrl(`/api/drinks/catalog?${params}`), {
      // Send the shared login session only to this origin; keep cross-origin requests credential-free.
      credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal: owner.signal,
    })
    if (!response.ok) throw new Error('Catalog unavailable')
    const page = validateCatalogPage(await response.json(), category, offset)
    signal.throwIfAborted()

    catalogCache.set(catalogCacheKey(category, query, offset), {
      page,
      expiresAt: Date.now() + CATALOG_CACHE_TTL_MS,
    })

    return page
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
  }
}
/** Copy single-container attributes only; consumption and explicit saving stay in the existing form. */
export function selectCatalogProduct(current: ManualDrinkFormValues, product: CatalogProduct): ManualDrinkFormValues {
  const validated = validateCatalogProduct(product)
  return { ...current, drinkType: validated.drinkType, drinkName: validated.drinkName,
    servingSizeSelection: CUSTOM_SERVING_SIZE, customVolumeMl: String(validated.volumeMl), abvPercent: String(validated.abvPercent) }
}
