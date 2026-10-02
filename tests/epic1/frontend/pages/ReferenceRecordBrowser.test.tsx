/** Public catalog categories must never fall back to personal templates or history. */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RECORD_HOME_EVENT } from '../../../../frontend/src/app/entryPaths'
import { ReferenceRecordBrowser } from '../../../../frontend/src/features/drinks/components/ReferenceRecordBrowser'

import { createRecordHelpPreference, RECORD_HELP_SEEN_KEY } from '../../../../frontend/src/features/drinks/storage/recordHelpPreference'

const savedDrinks = [
  { id: 'test-beer', drinkType: 'beer' as const, drinkName: 'Synthetic personal beer', servingVolumeMl: 330, abvPercent: 5, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
  { id: 'test-wine', drinkType: 'wine' as const, drinkName: 'Synthetic personal wine', servingVolumeMl: 150, abvPercent: 12, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
]
function setup(onProduct = vi.fn(), dismissHelp = true) {
  render(<ReferenceRecordBrowser savedDrinks={savedDrinks} onScan={() => undefined} onManual={() => undefined} onProduct={onProduct}>
    {drinks => <ul>{drinks.map(drink => <li key={drink.id}>{drink.drinkName}</li>)}</ul>}
  </ReferenceRecordBrowser>)
  if (dismissHelp) fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  return within(screen.getByRole('navigation', { name: 'Drink categories' }))
}
describe('Record source separation', () => {
  it.each(['All', 'Beer', 'Wine', 'Spirits', 'Cider', 'RTD', 'Other'])('keeps %s exclusively for public catalog data', category => {
    const navigation = setup()
    fireEvent.click(navigation.getByRole('button', { name: 'My Drinks' }))
    expect(screen.getByText('Synthetic personal beer')).toBeInTheDocument()
    fireEvent.click(navigation.getByRole('button', { name: category }))
    expect(screen.queryByText('Synthetic personal beer')).not.toBeInTheDocument()
    expect(screen.queryByText('Synthetic personal wine')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading drinks')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Synthetic personal' } })
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByText('Drink not found')).not.toBeInTheDocument()
  })
  it('searches only explicitly saved templates in My Drinks and preserves them across category changes', () => {
    const navigation = setup()
    fireEvent.click(navigation.getByRole('button', { name: 'My Drinks' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'WINE' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('Synthetic personal wine')).toBeInTheDocument()
    fireEvent.click(navigation.getByRole('button', { name: 'All' }))
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    fireEvent.click(navigation.getByRole('button', { name: 'My Drinks' }))
    expect(screen.getByText('Synthetic personal wine')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})

const catalogDrink = { productId: 'cloud', drinkName: 'Synthetic cloud beer', drinkType: 'beer', volumeMl:330, abvPercent:5, sourceName:'Synthetic source',sourceUrl:'https://example.org/data' }
const catalogPage = { products:[catalogDrink],total:1,offset:0,limit:24 }
// Advance beyond the public cache TTL so each network scenario owns its request.
// Keep the real cache implementation active within each scenario.
let cacheEpoch = Date.now()
beforeEach(() => { cacheEpoch += 6 * 60 * 1000; vi.spyOn(Date, 'now').mockReturnValue(cacheEpoch) })
afterEach(() => vi.restoreAllMocks())
it('renders remote products without management actions and passes selection without saving locally', async () => {
  vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify(catalogPage)))
  const choose=vi.fn();setup(choose)
  fireEvent.click(await screen.findByRole('button',{name:/Synthetic cloud beer/}))
  expect(choose).toHaveBeenCalledWith(catalogDrink)
  expect(screen.queryByRole('button',{name:'Delete'})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'My Drinks'}))
  expect(screen.queryByText('Synthetic cloud beer')).not.toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})
it('discards late results after switching category and does not request local search', async () => {
  let finish: (response:Response)=>void = () => undefined
  const fetch=vi.spyOn(globalThis,'fetch').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  setup()
  await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce())
  const signal=fetch.mock.calls[0][1]?.signal
  fireEvent.click(screen.getByRole('button',{name:'My Drinks'}))
  expect(signal?.aborted).toBe(true)
  finish(new Response(JSON.stringify(catalogPage)))
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'wine'}})
  expect(screen.getByText('Synthetic personal wine')).toBeInTheDocument()
  expect(screen.queryByText('Synthetic cloud beer')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledOnce()
})
it('shows retry on service failure without replacing the catalog with personal drinks', async () => {
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response('{}',{status:503}))
    .mockResolvedValueOnce(new Response(JSON.stringify(catalogPage)))
  setup()
  fireEvent.click(await screen.findByRole('button',{name:'Retry catalog'}))
  expect(await screen.findByRole('button',{name:/Synthetic cloud beer/})).toBeInTheDocument()
  expect(screen.queryByText('Synthetic personal beer')).not.toBeInTheDocument()
})

it('shows guidance once, preserves dismissal across Record navigation and remount, and reopens on demand', () => {
  const navigation = setup(vi.fn(), false)
  expect(screen.getByRole('dialog', { name: 'How to record a drink' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  expect(localStorage.getItem(RECORD_HELP_SEEN_KEY)).toBe('1')
  fireEvent.click(navigation.getByRole('button', { name: 'Beer' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ale' } })
  fireEvent(window, new Event(RECORD_HOME_EVENT))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  cleanup()
  setup(vi.fn(), false)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'How to record a drink' }))
  const dialog = screen.getByRole('dialog', { name: 'How to record a drink' })
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it.each(['escape', 'backdrop'])('remembers first-use dismissal through %s', method => {
  setup(vi.fn(), false)
  const dialog = screen.getByRole('dialog', { name: 'How to record a drink' })
  if (method === 'escape') fireEvent(dialog, new Event('cancel', { cancelable: true }))
  else fireEvent.click(dialog)
  expect(localStorage.getItem(RECORD_HELP_SEEN_KEY)).toBe('1')
  cleanup()
  setup(vi.fn(), false)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('uses a previously persisted flag on a fresh visit and leaves other storage untouched', () => {
  localStorage.setItem(RECORD_HELP_SEEN_KEY, '1')
  localStorage.setItem('unrelated-preference', 'keep')
  setup(vi.fn(), false)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'How to record a drink' }))
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  expect(localStorage.getItem('unrelated-preference')).toBe('keep')
  localStorage.removeItem('unrelated-preference')
})

it.each(['getter', 'read', 'write'])('keeps an in-page dismissal when storage fails at %s', failure => {
  const unavailable = () => { throw new DOMException('Blocked', 'SecurityError') }
  const preference = createRecordHelpPreference(() => {
    if (failure === 'getter') return unavailable()
    return { getItem: failure === 'read' ? unavailable : () => null, setItem: unavailable }
  })
  expect(preference.hasSeen()).toBe(false)
  expect(() => preference.markSeen()).not.toThrow()
  expect(preference.hasSeen()).toBe(true)
})

it('distinguishes same-name products by brand without changing their selection identity', async () => {
  const products = [
    { ...catalogDrink, productId: 'a', drinkName: '12 Year Old', brandName: 'Distillery A' },
    { ...catalogDrink, productId: 'b', drinkName: '12 Year Old', brandName: 'Distillery B' },
    { ...catalogDrink, productId: 'c', drinkName: '12 Year Old', brandName: null },
  ]
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ...catalogPage, products, total: 3 })))
  const choose = vi.fn(); setup(choose)
  const first = (await screen.findByText('Brand: Distillery A')).closest('button')!
  expect(screen.getByText('Brand: Distillery B')).toBeVisible()
  expect(screen.getByText('Brand not provided')).toBeVisible()
  fireEvent.click(first)
  expect(choose).toHaveBeenCalledWith(products[0])
})
