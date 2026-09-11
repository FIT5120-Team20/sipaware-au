/**
 * Exact catalog boundary: only the decoded text leaves this device. Neither
 * lookup nor product confirmation saves personal templates or drinking records.
 */
import { buildApiUrl } from '../../../services/apiBaseUrl'
import { isDrinkType } from '../config/drinkTypes'
import type { DrinkType } from '../types/drinkingRecord'
import type { ManualDrinkFormValues } from '../types/manualDrinkForm'
import { CUSTOM_SERVING_SIZE } from '../types/manualDrinkForm'

export interface BarcodeProduct {
  productId: string
  barcode: string
  drinkName: string
  drinkType: DrinkType
  volumeMl: number
  abvPercent: number
  sourceName: string
  sourceUrl: string
  packQuantity: number
  totalPackageVolumeMl: number
}

export type BarcodeLookupResult =
  | { kind: 'match'; product: BarcodeProduct }
  | { kind: 'not-found' }
  | { kind: 'unavailable' }

/** The API receives only the decoded string; camera pixels remain local. */
export type BarcodeLookup = (
  barcode: string,
  signal: AbortSignal,
) => Promise<unknown>

export const lookupBarcode: BarcodeLookup = async (barcode, signal) => {
  signal.throwIfAborted()
  const owner = new AbortController()
  const cancel = () => owner.abort(signal.reason)
  signal.addEventListener('abort', cancel, { once: true })
  // Bound the wait, including body reading. Back/unmount also cancels the request.
  const timeout = setTimeout(() => owner.abort(), 12000)
  try {
    const query = new URLSearchParams({ barcode })
    const response = await fetch(buildApiUrl(`/api/drinks/barcode?${query}`), {
      method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' },
      signal: owner.signal, cache: 'no-store',
    })
    if (!response.ok) return { kind: 'unavailable' }
    const result = validateLookupResult(await response.json(), barcode)
    signal.throwIfAborted()
    return result
  } catch {
    signal.throwIfAborted()
    return { kind: 'unavailable' }
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sourceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
  } catch { return false }
}

function nonempty(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

/**
 * Reject malformed responses and approximate matches before showing a product.
 * Barcode strings are compared byte-for-byte: leading zeros and their meaning
 * follow the DS contract; UPC/EAN aliases are not inferred.
 */
export function validateLookupResult(
  value: unknown,
  barcode: string,
): BarcodeLookupResult {
  if (!object(value)) throw new Error('Invalid barcode lookup response')
  if (value.kind === 'unavailable') return { kind: 'unavailable' }
  if (value.kind === 'not-found') return { kind: 'not-found' }
  const product = value.product
  if (
    value.kind !== 'match' || !object(product) ||
    !nonempty(product.productId, 200) || !nonempty(product.drinkName, 200) ||
    !nonempty(product.sourceName, 300) || !sourceUrl(product.sourceUrl) || product.barcode !== barcode ||
    typeof product.packQuantity !== 'number' || !Number.isSafeInteger(product.packQuantity) ||
    product.packQuantity < 1 || product.packQuantity > 100000 ||
    typeof product.totalPackageVolumeMl !== 'number' || !Number.isFinite(product.totalPackageVolumeMl) ||
    product.totalPackageVolumeMl <= 0 ||
    !isDrinkType(product.drinkType) ||
    typeof product.volumeMl !== 'number' || !Number.isFinite(product.volumeMl) ||
    product.volumeMl <= 0 || product.volumeMl > 100000 ||
    typeof product.abvPercent !== 'number' || !Number.isFinite(product.abvPercent) ||
    product.abvPercent < 0 || product.abvPercent > 100
  ) throw new Error('Invalid barcode product')
  const expected = product.volumeMl * product.packQuantity
  if (Math.abs(product.totalPackageVolumeMl - expected) > Math.max(0.000001, expected * 1e-9)) {
    throw new Error('Invalid barcode package')
  }
  return {
    kind: 'match',
    product: {
      productId: product.productId, barcode, drinkName: product.drinkName,
      drinkType: product.drinkType, volumeMl: product.volumeMl,
      abvPercent: product.abvPercent, sourceName: product.sourceName,
      sourceUrl: product.sourceUrl, packQuantity: product.packQuantity,
      totalPackageVolumeMl: product.totalPackageVolumeMl,
    },
  }
}

/**
 * Copy only reviewed reusable attributes. Explicit servings, Date and Time stay
 * exactly as entered; the existing form still validates and explicitly saves.
 * The single-container volume becomes editable Custom volume, never the whole
 * sales pack or a guessed
 * standard serving. No template or historical record is modified here.
 */
export function selectBarcodeProduct(
  current: ManualDrinkFormValues,
  product: BarcodeProduct,
): ManualDrinkFormValues {
  validateLookupResult({ kind: 'match', product }, product.barcode)
  return {
    ...current,
    drinkType: product.drinkType,
    drinkName: product.drinkName,
    servingSizeSelection: CUSTOM_SERVING_SIZE,
    customVolumeMl: String(product.volumeMl),
    abvPercent: String(product.abvPercent),
  }
}
