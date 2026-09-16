/**
 * New UI amount modes use the same validated/persisted domain contract.
 * Fixtures are test-only and never populate the application catalog.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ManualDrinkForm } from '../../../../frontend/src/features/drinks/components/ManualDrinkForm'
import type { DrinkingRecord } from '../../../../frontend/src/features/drinks/types/drinkingRecord'
import type { SavedDrink } from '../../../../frontend/src/features/drinks/types/savedDrink'
import { DRINK_REFERENCE_CATEGORIES } from '../fixtures/drinkReferenceFixture'

async function setup(templateFailure = false) {
  const onSave = vi.fn<(record: DrinkingRecord) => Promise<void>>().mockResolvedValue(undefined)
  const onSaveSavedDrink = vi.fn<(drink: SavedDrink) => Promise<void>>(async () => {
    if (templateFailure) throw new Error('Test-only template failure')
  })
  render(<ManualDrinkForm referenceCategories={DRINK_REFERENCE_CATEGORIES}
    referenceStatus="loaded" onRetryReferenceData={() => undefined}
    savedDrinks={[]} onSave={onSave} onSaveSavedDrink={onSaveSavedDrink}
    onUpdateSavedDrink={() => undefined} onDeleteSavedDrink={() => undefined} />)
  const user = userEvent.setup()
  await user.selectOptions(screen.getByLabelText('Drink type'), 'beer')
  fireEvent.change(screen.getByLabelText('Drink name'), { target: { value: 'Synthetic amount fixture' } })
  await user.selectOptions(screen.getByLabelText('Serving size / volume'), '375')
  fireEvent.change(screen.getByLabelText('ABV (%)'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-26' } })
  fireEvent.change(screen.getByLabelText('Time'), { target: { value: '19:30' } })
  return { user, onSave, onSaveSavedDrink }
}
describe('Reference consumption controls', () => {
  it('converts mL to servings without saving an unchecked drink to My Drinks', async () => {
    const { user, onSave, onSaveSavedDrink } = await setup()
    await user.click(screen.getByRole('button', { name: 'By mL' }))
    fireEvent.change(screen.getByLabelText('Amount in mL'), { target: { value: '750' } })
    expect(screen.getByText('3.0')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Record Drink' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSaveSavedDrink).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Save this drink to My Drinks' })).not.toBeInTheDocument()
    expect(onSave.mock.calls[0][0]).toMatchObject({
      servingVolumeMl: 375, amountConsumed: 2, abvPercent: 5,
      consumedAt: new Date(2026, 7, 26, 19, 30).toISOString(),
    })
  })
  it('keeps consumed volume stable when changing serving size in mL mode', async () => {
    const { user, onSave } = await setup()
    fireEvent.change(screen.getByLabelText('Number of servings consumed'), { target: { value: '1.5' } })
    await user.click(screen.getByRole('button', { name: 'By mL' }))
    expect(screen.getByLabelText('Amount in mL')).toHaveValue(562.5)
    await user.selectOptions(screen.getByLabelText('Serving size / volume'), 'custom')
    fireEvent.change(screen.getByLabelText('Custom volume (mL)'), { target: { value: '500' } })
    await user.click(screen.getByRole('button', { name: 'By serving' }))
    expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(1.125)
    await user.click(screen.getByRole('button', { name: 'Record Drink' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toMatchObject({ servingVolumeMl: 500, amountConsumed: 1.125 })
  })
  it.each(['', '0', '-10'])('rejects invalid mL "%s" and focuses the visible input', async value => {
    const { user, onSave } = await setup()
    await user.click(screen.getByRole('button', { name: 'By mL' }))
    fireEvent.change(screen.getByLabelText('Amount in mL'), { target: { value } })
    await user.click(screen.getByRole('button', { name: 'Record Drink' }))
    expect(await screen.findByText('Enter an amount greater than 0 servings.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Amount in mL')).toHaveFocus())
    expect(onSave).not.toHaveBeenCalled()
  })
  it('records the occasion and saves only reusable fields when the checkbox is selected', async () => {
    const { user, onSave, onSaveSavedDrink } = await setup()
    await user.click(screen.getByRole('button', { name: 'Increase servings' }))
    await user.click(screen.getByRole('checkbox', { name: /Save this drink to My Drinks/ }))
    await user.click(screen.getByRole('button', { name: 'Record Drink' }))
    await waitFor(() => expect(onSaveSavedDrink).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSaveSavedDrink.mock.calls[0][0]).not.toHaveProperty('amountConsumed')
    expect(onSaveSavedDrink.mock.calls[0][0]).not.toHaveProperty('consumedAt')
    expect(onSave.mock.calls[0][0]).toMatchObject({ amountConsumed: 0.5 })
  })
  it('distinguishes a template failure after a successful record without retrying history', async () => {
    const { user, onSave, onSaveSavedDrink } = await setup(true)
    await user.click(screen.getByRole('button', { name: 'Increase servings' }))
    await user.click(screen.getByRole('checkbox', { name: /Save this drink to My Drinks/ }))
    await user.click(screen.getByRole('button', { name: 'Record Drink' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Drinking record saved on this device, but')
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSaveSavedDrink).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(null)
  })
})



it('revalidates dynamic volume/alcohol limits across size and ABV changes', async () => {
 const { user, onSave } = await setup()
 await user.selectOptions(screen.getByLabelText('Serving size / volume'), 'custom')
 fireEvent.change(screen.getByLabelText('Custom volume (mL)'), {target:{value:'700'}})
 fireEvent.change(screen.getByLabelText('Number of servings consumed'), {target:{value:'16'}})
 expect(screen.getByRole('button',{name:'Record Drink'})).toBeDisabled()
 expect(screen.getByRole('button',{name:'Increase servings'})).toBeDisabled()
 await user.click(screen.getByRole('button',{name:'By mL'}))
 const ml=screen.getByLabelText('Amount in mL')
 expect(ml).toHaveAttribute('max','10000')
 expect(ml).toHaveValue(11200)
 fireEvent.submit(screen.getByRole('button',{name:'Record Drink'}).closest('form')!)
 expect(onSave).not.toHaveBeenCalled()
 fireEvent.change(ml,{target:{value:'10000'}})
 expect(screen.getByRole('button',{name:'Increase mL'})).toBeDisabled()
 expect(screen.getByRole('button',{name:'Record Drink'})).toBeEnabled()
 // Changing serving size changes the count, not the consumed mL; ABV can tighten the cap.
 fireEvent.change(screen.getByLabelText('Custom volume (mL)'),{target:{value:'350'}})
 expect(ml).toHaveValue(10000)
 expect(ml).toHaveAttribute('max','10000')
 expect(screen.getByRole('button',{name:'Record Drink'})).toBeEnabled()
 fireEvent.change(screen.getByLabelText('ABV (%)'),{target:{value:'40'}})
 expect(Number(ml.getAttribute('max'))).toBeCloseTo(1584.2839,3)
 expect(screen.getByRole('button',{name:'Record Drink'})).toBeDisabled()
 expect(screen.getByText(/amount appears unusually high/)).toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Custom volume (mL)'),{target:{value:'0'}})
 expect(ml).toBeDisabled()
 fireEvent.change(screen.getByLabelText('Custom volume (mL)'),{target:{value:'700'}})
 fireEvent.change(ml,{target:{value:'1000'}})
 await user.click(screen.getByRole('button',{name:'Record Drink'}))
 await waitFor(()=>expect(onSave).toHaveBeenCalledOnce())
 expect(onSave.mock.calls[0][0]).toMatchObject({servingVolumeMl:700,amountConsumed:1000/700})
})
it('stops a plus step that exceeds the dynamic boundary without clamping typed overflow', async()=>{
 const {user}=await setup()
 fireEvent.change(screen.getByLabelText('Number of servings consumed'),{target:{value:'26.5'}})
 await user.click(screen.getByRole('button',{name:'Increase servings'}))
 expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(26.5)
 expect(screen.getByRole('button',{name:'Increase servings'})).toBeDisabled()
 expect(screen.getByText(/Record limit reached/)).toBeInTheDocument()
 fireEvent.change(screen.getByLabelText('Number of servings consumed'),{target:{value:'25'}})
 expect(screen.getByRole('button',{name:'Increase servings'})).toBeEnabled()
 await user.click(screen.getByRole('button',{name:'Increase servings'}))
 expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(25.5)
 fireEvent.change(screen.getByLabelText('Number of servings consumed'),{target:{value:'27'}})
 expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(27)
 expect(screen.getByText(/amount appears unusually high/)).toBeInTheDocument()
})
