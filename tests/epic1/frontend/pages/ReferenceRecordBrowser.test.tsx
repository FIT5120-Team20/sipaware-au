/** Public catalog categories must never fall back to personal templates or history. */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReferenceRecordBrowser } from '../../../../frontend/src/features/drinks/components/ReferenceRecordBrowser'

const savedDrinks = [
  { id: 'test-beer', drinkType: 'beer' as const, drinkName: 'Synthetic personal beer', servingVolumeMl: 330, abvPercent: 5, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
  { id: 'test-wine', drinkType: 'wine' as const, drinkName: 'Synthetic personal wine', servingVolumeMl: 150, abvPercent: 12, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
]
function setup(onProduct = vi.fn()) {
  render(<ReferenceRecordBrowser savedDrinks={savedDrinks} onScan={() => undefined} onManual={() => undefined} onProduct={onProduct}>
    {drinks => <ul>{drinks.map(drink => <li key={drink.id}>{drink.drinkName}</li>)}</ul>}
  </ReferenceRecordBrowser>)
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
