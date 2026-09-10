/**
 * Frontend-only product-selection boundary for assisted capture.
 *
 * DS has not supplied a catalog or API contract. The production adapter therefore
 * performs no request and reports unavailable. These UI types are not a proposed
 * database schema; a later approved FastAPI adapter must map and validate its DTO.
 * Neither this boundary nor selecting a product creates personal browser records.
 */
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
}

export type BarcodeLookupResult =
  | { kind: 'match'; product: BarcodeProduct }
  | { kind: 'not-found' }
  | { kind: 'unavailable' }

/** A future adapter receives only the decoded string and cancellation signal. */
export type BarcodeLookup = (
  barcode: string,
  signal: AbortSignal,
) => Promise<unknown>

export const lookupBarcode: BarcodeLookup = async (_barcode, signal) => {
  signal.throwIfAborted()
  return { kind: 'unavailable' }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonempty(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

/**
 * Reject malformed responses and approximate matches before showing a product.
 * Barcode strings are compared byte-for-byte: leading zeros and their meaning
 * belong to the future approved catalog contract, not to UI normalization.
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
    !nonempty(product.sourceName, 300) || product.barcode !== barcode ||
    !isDrinkType(product.drinkType) ||
    typeof product.volumeMl !== 'number' || !Number.isFinite(product.volumeMl) ||
    product.volumeMl <= 0 || product.volumeMl > 100000 ||
    typeof product.abvPercent !== 'number' || !Number.isFinite(product.abvPercent) ||
    product.abvPercent < 0 || product.abvPercent > 100
  ) throw new Error('Invalid barcode product')
  return {
    kind: 'match',
    product: {
      productId: product.productId, barcode, drinkName: product.drinkName,
      drinkType: product.drinkType, volumeMl: product.volumeMl,
      abvPercent: product.abvPercent, sourceName: product.sourceName,
    },
  }
}

/**
 * Copy only reviewed reusable attributes. Explicit servings, Date and Time stay
 * exactly as entered; the existing form still validates and explicitly saves.
 * The supplied package volume becomes editable Custom volume, never a guessed
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
