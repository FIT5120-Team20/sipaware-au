/** Public catalog categories must never fall back to personal templates or history. */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReferenceRecordBrowser } from '../../../../frontend/src/features/drinks/components/ReferenceRecordBrowser'

const savedDrinks = [
  { id: 'test-beer', drinkType: 'beer' as const, drinkName: 'Synthetic personal beer', servingVolumeMl: 330, abvPercent: 5, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
  { id: 'test-wine', drinkType: 'wine' as const, drinkName: 'Synthetic personal wine', servingVolumeMl: 150, abvPercent: 12, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
]
function setup() {
  render(<ReferenceRecordBrowser savedDrinks={savedDrinks} onScan={() => undefined} onManual={() => undefined}>
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
    expect(screen.getByRole('status')).toHaveTextContent('Product catalog temporarily unavailable')
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
