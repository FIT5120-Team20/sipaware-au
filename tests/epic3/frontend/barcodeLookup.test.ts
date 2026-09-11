/**
 * Synthetic contract tests validate the frontend boundary only.
 * No fixture here claims a real catalog product or database integration result.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  lookupBarcode, selectBarcodeProduct, validateLookupResult, type BarcodeProduct,
} from '../../../frontend/src/features/drinks/barcode/barcodeLookup'
import type { ManualDrinkFormValues } from '../../../frontend/src/features/drinks/types/manualDrinkForm'

const product: BarcodeProduct = {
  productId: 'synthetic-only', barcode: '000000000001', drinkName: 'Synthetic barcode drink',
  drinkType: 'beer', volumeMl: 330, abvPercent: 5, sourceName: 'Synthetic test source',
  sourceUrl: 'https://example.org/source', packQuantity: 6, totalPackageVolumeMl: 1980,
}
describe('US 3.1 exact lookup HTTP boundary', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
  it('sends only the exact barcode and validates the returned match', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ kind: 'match', product })))
    await expect(lookupBarcode(product.barcode, new AbortController().signal)).resolves.toEqual({ kind: 'match', product })
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/drinks/barcode?barcode=000000000001'), {
      method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' },
      signal: expect.any(AbortSignal), cache: 'no-store',
    })
  })
  it('returns a confirmed database miss', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ kind: 'not-found' })))
    await expect(lookupBarcode('01234567', new AbortController().signal)).resolves.toEqual({ kind: 'not-found' })
  })
  it.each(['service', 'network', 'json', 'wrong-product'])('treats %s failure as unavailable, never not-found', async (kind) => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    if (kind === 'network') fetch.mockRejectedValue(new Error('offline'))
    else fetch.mockResolvedValue(kind === 'service' ? new Response('{}', { status: 503 })
      : new Response(kind === 'json' ? 'bad-json' : JSON.stringify({ kind: 'match', product: { ...product, barcode: '1' } })))
    await expect(lookupBarcode(product.barcode, new AbortController().signal)).resolves.toEqual({ kind: 'unavailable' })
  })
  it('cancels the in-flight request on Back instead of showing a late result', async () => {
    let requestSignal: AbortSignal | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      requestSignal = options?.signal as AbortSignal
      return new Promise((_resolve, reject) => requestSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
    })
    const owner = new AbortController()
    const pending = lookupBarcode(product.barcode, owner.signal)
    const assertion = expect(pending).rejects.toThrow()
    owner.abort(); await assertion
    expect(requestSignal?.aborted).toBe(true)
  })
  it('bounds an unresponsive request and allows manual recovery', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const pending = lookupBarcode(product.barcode, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(12000)
    await expect(pending).resolves.toEqual({ kind: 'unavailable' })
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
    { sourceUrl: 'javascript:alert(1)' },
    { packQuantity: 0 }, { packQuantity: 1.5 }, { totalPackageVolumeMl: 330 },
    { totalPackageVolumeMl: Number.NaN },
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
