/** Synthetic HTTP and form-boundary tests; live database checks are separate. */
import { afterEach, expect, it, vi } from 'vitest'
import { loadCatalog, selectCatalogProduct, validateCatalogPage } from '../../../frontend/src/features/drinks/catalog/catalogApi'
import type { CatalogProduct } from '../../../frontend/src/features/drinks/catalog/catalogApi'
const product: CatalogProduct = { productId: 'test', drinkName: 'Synthetic beer', drinkType: 'beer',
  volumeMl: 330, abvPercent: 5, sourceName: 'Synthetic source', sourceUrl: 'https://example.org/data' }
const page = { products: [product], total: 1, limit: 24, offset: 0 }
afterEach(() => vi.restoreAllMocks())
it('sends only public browse criteria, with a same-origin session and no personal records', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(page)))
  expect(await loadCatalog('beer', ' 50% ', 0, new AbortController().signal)).toEqual(page)
  const [url, options] = fetch.mock.calls[0]
  const query = new URL(String(url), 'http://local').searchParams
  expect(Object.fromEntries(query)).toEqual({category:'beer',q:'50%',offset:'0',limit:'24'})
  expect(options).toMatchObject({credentials:'same-origin',cache:'no-store'})
  expect(options?.body).toBeUndefined()
})
it('copies a single container without changing quantity, date or time', () => {
  const current = { drinkType: '' as const, drinkName: '', servingSizeSelection:'',customVolumeMl:'',abvPercent:'',amountConsumed:'2.5',date:'2026-09-11',time:'18:32' }
  const next=selectCatalogProduct(current,product)
  expect(next).toEqual({...current,drinkType:'beer',drinkName:'Synthetic beer',servingSizeSelection:'custom',customVolumeMl:'330',abvPercent:'5'})
  expect(current.drinkName).toBe('')
})
it.each([
  {...page,products:[{...product,volumeMl:0}]}, {...page,products:[{...product,sourceUrl:'javascript:alert(1)'}]},
  {...page,products:[{...product,drinkType:'wine'}]}, {...page,offset:24},
  {...page,products:[product,product],total:2}, {...page,total:NaN}, {...page,products:[],total:1},
])('rejects malformed, duplicate, wrong category or wrong page responses', value => {
  expect(()=>validateCatalogPage(value,'beer',0)).toThrow()
})
it('keeps request cancellation effective while reading the body', async () => {
  const owner=new AbortController()
  vi.spyOn(globalThis,'fetch').mockImplementation((_url, options) => new Promise((_resolve,reject) => {
    options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))
  }))
  const pending=loadCatalog('all','',0,owner.signal)
  const assertion=expect(pending).rejects.toThrow()
  owner.abort();await assertion
})
it('does not turn a server failure into an empty catalog', async () => {
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:503}))
  await expect(loadCatalog('all','',0,new AbortController().signal)).rejects.toThrow()
})
