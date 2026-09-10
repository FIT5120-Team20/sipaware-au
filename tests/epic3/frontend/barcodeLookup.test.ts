/**
 * Synthetic contract tests validate the frontend boundary only.
 * No fixture here claims a real catalog product or database integration result.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  lookupBarcode, selectBarcodeProduct, validateLookupResult, type BarcodeProduct,
} from '../../../frontend/src/features/drinks/barcode/barcodeLookup'
import type { ManualDrinkFormValues } from '../../../frontend/src/features/drinks/types/manualDrinkForm'

const product: BarcodeProduct = {
  productId: 'synthetic-only', barcode: '000000000001', drinkName: 'Synthetic barcode drink',
  drinkType: 'beer', volumeMl: 330, abvPercent: 5, sourceName: 'Synthetic test source',
}
describe('US 3.1 frontend lookup boundary; real catalog deferred', () => {
  it('ordinary runtime is unavailable, never a confirmed miss, and sends no request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    await expect(lookupBarcode(product.barcode, new AbortController().signal)).resolves.toEqual({ kind: 'unavailable' })
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockRestore()
  })
  it('honors cancellation without starting a lookup', async () => {
    const owner = new AbortController(); owner.abort()
    await expect(lookupBarcode(product.barcode, owner.signal)).rejects.toThrow()
  })
  it('AC 5 / AC 8: accepts an exact synthetic match including significant zeros', () => {
    expect(validateLookupResult({ kind: 'match', product }, product.barcode)).toEqual({ kind: 'match', product })
  })
  it('AC 10: only an explicit completed miss becomes not-found', () => {
    expect(validateLookupResult({ kind: 'not-found' }, product.barcode)).toEqual({ kind: 'not-found' })
    for (const bad of [null, {}, { kind: 'error' }, { kind: 'match' }]) {
      expect(() => validateLookupResult(bad, product.barcode)).toThrow()
    }
  })
  it.each([
    { barcode: '1' }, { barcode: '000000000002' }, { drinkType: 'invented-category' },
    { volumeMl: 0 }, { volumeMl: Number.NaN }, { abvPercent: 101 }, { abvPercent: Number.POSITIVE_INFINITY },
    { drinkName: '' }, { sourceName: '' }, { productId: '' },
  ])('rejects malformed or approximate synthetic product %j', (change) => {
    expect(() => validateLookupResult({ kind: 'match', product: { ...product, ...change } }, product.barcode)).toThrow()
  })
  it('AC 5 / AC 8 handoff preserves consumption draft and leaves both input objects unchanged', () => {
    const draft: ManualDrinkFormValues = {
      drinkType: 'wine', drinkName: 'Unsaved personal draft', servingSizeSelection: 'custom',
      customVolumeMl: '150', abvPercent: '12', amountConsumed: '1.5', date: '2026-09-08', time: '20:10',
    }
    const before = structuredClone(draft), beforeProduct = structuredClone(product)
    const result = selectBarcodeProduct(draft, product)
    expect(result).toEqual({ ...draft, drinkType: 'beer', drinkName: product.drinkName,
      servingSizeSelection: 'custom', customVolumeMl: '330', abvPercent: '5' })
    expect(draft).toEqual(before)
    expect(product).toEqual(beforeProduct)
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('createdAt')
  })
})
