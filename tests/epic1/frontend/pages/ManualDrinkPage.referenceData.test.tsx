/** Protects public reference loading boundaries without blocking local personal data. */

import {
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DRINK_OPTIONS_RESPONSE } from '../fixtures/drinkReferenceFixture'
import { ManualDrinkPage } from '../../../../frontend/src/features/drinks/pages/ManualDrinkPage'
import { IndexedDbSavedDrinkRepository } from '../../../../frontend/src/features/drinks/storage/savedDrinkRepository'
import type { SavedDrink } from '../../../../frontend/src/features/drinks/types/savedDrink'

function successfulReferenceResponse(): Response {
  return new Response(JSON.stringify(DRINK_OPTIONS_RESPONSE), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function renderLoadedPage() {
  render(<ManualDrinkPage />)
  const drinkType = await screen.findByLabelText('Drink type')
  await waitFor(() => expect(drinkType).toBeEnabled())
  return drinkType
}

describe('ManualDrinkPage public reference loading', () => {
  it('shows reference loading without blocking hydrated personal data', async () => {
    const savedDrink: SavedDrink = {
      id: 'loading-saved-drink',
      drinkType: 'beer',
      drinkName: 'Browser-local beer',
      servingVolumeMl: 375,
      abvPercent: 4.5,
      createdAt: '2026-08-25T08:00:00.000Z',
      updatedAt: '2026-08-25T08:00:00.000Z',
    }
    await new IndexedDbSavedDrinkRepository().add(savedDrink)
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))

    render(<ManualDrinkPage />)

    expect(
      await screen.findByText('Loading current drink reference options...'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /Browser-local beer.*Beer.*375 mL.*4.5% ABV/,
      }),
    ).toBeInTheDocument()
  })

  it('shows an explicit failure and retries without changing IndexedDB data', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Reference service unavailable'))
      .mockResolvedValueOnce(successfulReferenceResponse())
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<ManualDrinkPage />)

    expect(
      await screen.findByText(/reference options are temporarily unavailable/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Drink type')).toBeDisabled()

    await user.click(
      screen.getByRole('button', { name: 'Retry drink options' }),
    )

    await waitFor(() => expect(screen.getByLabelText('Drink type')).toBeEnabled())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      within(screen.getByLabelText('Drink type')).getByRole('option', {
        name: 'Straight Spirits',
      }),
    ).toHaveValue('spirits')
  })

  it('loads eight compatible categories and reference-driven variant scopes', async () => {
    const user = userEvent.setup()
    const drinkType = await renderLoadedPage()

    expect(within(drinkType).getAllByRole('option')).toHaveLength(9)
    for (const name of [
      'Beer',
      'Wine',
      'Cider',
      'Straight Spirits',
      'RTD / Premixed',
      'Cocktail',
      'Liqueur',
      'Other',
    ]) {
      expect(within(drinkType).getByRole('option', { name })).toBeInTheDocument()
    }

    await user.selectOptions(drinkType, 'beer')
    const beerSubtype = screen.getByLabelText('Drink subtype (optional)')
    expect(
      within(beerSubtype).getByRole('option', { name: 'Light beer' }),
    ).toBeInTheDocument()
    expect(
      within(beerSubtype).getByRole('option', { name: 'Mid-strength beer' }),
    ).toBeInTheDocument()
    expect(
      within(beerSubtype).getByRole('option', { name: 'Full-strength beer' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Serving size / volume')).getByRole(
        'option',
        { name: 'Small glass — 285 mL' },
      ),
    ).toBeInTheDocument()

    await user.selectOptions(drinkType, 'wine')
    const wineSubtype = screen.getByLabelText('Drink subtype (optional)')
    expect(
      within(wineSubtype).getByRole('option', { name: 'Red wine' }),
    ).toBeInTheDocument()
    expect(
      within(wineSubtype).getByRole('option', { name: 'White wine' }),
    ).toBeInTheDocument()
    expect(
      within(wineSubtype).getByRole('option', { name: 'Champagne' }),
    ).toBeInTheDocument()
    expect(
      within(wineSubtype).getByRole('option', { name: 'Fortified wine' }),
    ).toBeInTheDocument()

    await user.selectOptions(wineSubtype, '4')
    const wineServing = screen.getByLabelText('Serving size / volume')
    expect(
      within(wineServing).getByRole('option', {
        name: 'Standard serve — 100 mL',
      }),
    ).toBeInTheDocument()
    expect(
      within(wineServing).getByRole('option', {
        name: 'Average restaurant serving — 150 mL',
      }),
    ).toBeInTheDocument()
    expect(
      within(wineServing).getByRole('option', { name: 'Bottle — 750 mL' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('ABV (%)')).toHaveValue(null)
  })

  it.each([
    ['cocktail', 'Cocktail'],
    ['liqueur', 'Liqueur'],
    ['other', 'Other'],
  ])(
    'keeps %s usable through Custom volume without an empty subtype control',
    async (drinkTypeValue, label) => {
      const user = userEvent.setup()
      const drinkType = await renderLoadedPage()

      await user.selectOptions(drinkType, drinkTypeValue)

      expect(screen.queryByLabelText('Drink subtype (optional)')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Serving size / volume')).toHaveValue('custom')
      expect(screen.getByLabelText('Custom volume (mL)')).toBeInTheDocument()
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument()
    },
  )

  it('hydrates legacy Cider and spirits SavedDrinks without rewriting values', async () => {
    const legacySavedDrinks: SavedDrink[] = [
      {
        id: 'legacy-cider',
        drinkType: 'cider',
        drinkName: 'Legacy cider',
        servingVolumeMl: 375,
        abvPercent: 4.9,
        createdAt: '2026-08-25T08:00:00.000Z',
        updatedAt: '2026-08-25T08:00:00.000Z',
      },
      {
        id: 'legacy-spirits',
        drinkType: 'spirits',
        drinkName: 'Legacy spirits',
        servingVolumeMl: 60,
        abvPercent: 40,
        createdAt: '2026-08-25T09:00:00.000Z',
        updatedAt: '2026-08-25T09:00:00.000Z',
      },
    ]
    const repository = new IndexedDbSavedDrinkRepository()
    for (const savedDrink of legacySavedDrinks) {
      await repository.add(savedDrink)
    }
    const user = userEvent.setup()
    await renderLoadedPage()

    await user.click(
      screen.getByRole('button', {
        name: /Legacy cider.*Cider.*375 mL.*4.9% ABV/,
      }),
    )
    expect(screen.getByLabelText('Serving size / volume')).toHaveValue('custom')
    expect(screen.getByLabelText('Custom volume (mL)')).toHaveValue(375)

    await user.click(
      screen.getByRole('button', {
        name: /Legacy spirits.*Straight Spirits.*60 mL.*40% ABV/,
      }),
    )
    expect(screen.getByLabelText('Drink type')).toHaveValue('spirits')
    expect(screen.getByLabelText('Custom volume (mL)')).toHaveValue(60)
    await expect(repository.list()).resolves.toEqual(legacySavedDrinks)
  })
})
