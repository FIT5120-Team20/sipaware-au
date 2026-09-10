/** Reference page transitions must follow committed local data, never a visual-only success. */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ManualDrinkPage } from '../../../../frontend/src/features/drinks/pages/ManualDrinkPage'
import { IndexedDbDrinkingRecordRepository } from '../../../../frontend/src/features/drinks/storage/drinkingRecordRepository'
import { SavedDrinkPicker } from '../../../../frontend/src/features/drinks/components/SavedDrinkPicker'
import { RecentDrinkingRecords } from '../../../../frontend/src/features/drinks/components/RecentDrinkingRecords'
import { DRINK_REFERENCE_CATEGORIES } from '../fixtures/drinkReferenceFixture'

async function fillRecord() {
  fireEvent.click(await screen.findByRole('button', { name: 'Record Manually' }))
  await waitFor(() => expect(screen.getByLabelText('Drink type')).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Drink type'), { target: { value: 'other' } })
  fireEvent.change(screen.getByLabelText('Drink name'), { target: { value: 'Synthetic flow drink' } })
  fireEvent.change(screen.getByLabelText('Custom volume (mL)'), { target: { value: '330' } })
  fireEvent.change(screen.getByLabelText('ABV (%)'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Number of servings consumed'), { target: { value: '1' } })
}
describe('reference flow boundaries', () => {
  it('keeps feedback off Record browse and opens help as a dismissible modal', async () => {
    render(<ManualDrinkPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'How to record a drink' }))
    expect(screen.getByRole('dialog', { name: 'How to record a drink' })).toHaveAttribute('open')
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    for (const name of ['Standard drink summary', 'Recent records', 'Learn more']) expect(screen.queryByRole('heading', { name })).not.toBeInTheDocument()
    await expect(new IndexedDbDrinkingRecordRepository().list()).resolves.toEqual([])
  })
  it('goes to the committed result, reloads it without a write and Done returns to browsing', async () => {
    const view = render(<ManualDrinkPage />)
    await fillRecord()
    fireEvent.click(screen.getByRole('button', { name: 'Record Drink' }))
    await screen.findByRole('heading', { name: 'Drink recorded' })
    const repository = new IndexedDbDrinkingRecordRepository()
    const records = await repository.list()
    expect(records).toHaveLength(1)
    expect(new URLSearchParams(window.location.search).get('record')).toBe(records[0].id)
    expect(screen.getByRole('link', { name: /Standard Drinks/ })).toHaveAttribute('href', '/alcohol-guidelines#STANDARD_DRINK')
    expect(screen.queryByRole('heading', { name: 'Recent records' })).not.toBeInTheDocument()
    view.unmount()
    render(<ManualDrinkPage />)
    await screen.findByRole('heading', { name: 'Drink recorded' })
    await expect(repository.list()).resolves.toEqual(records)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('button', { name: 'Record Manually' })).toBeInTheDocument()
    expect(window.location.search).toBe('')
    expect(screen.queryByRole('heading', { name: 'Standard drink summary' })).not.toBeInTheDocument()
    await expect(repository.list()).resolves.toEqual(records)
  })
  it('keeps failed record writes on the populated form instead of showing a result', async () => {
    const spy = vi.spyOn(IndexedDbDrinkingRecordRepository.prototype, 'add').mockRejectedValue(new Error('synthetic storage denial'))
    try {
      render(<ManualDrinkPage />)
      await fillRecord()
      fireEvent.click(screen.getByRole('button', { name: 'Record Drink' }))
      await screen.findByText(/This record could not be saved/)
      expect(screen.getByLabelText('Drink name')).toHaveValue('Synthetic flow drink')
      expect(screen.queryByRole('heading', { name: 'Drink recorded' })).not.toBeInTheDocument()
      expect(window.location.search).toBe('')
    } finally { spy.mockRestore() }
  })
  it('does not fabricate a result for an unavailable committed-record URL', async () => {
    window.history.replaceState({}, '', '/record?record=missing-synthetic-id')
    render(<ManualDrinkPage />)
    await screen.findByRole('heading', { name: 'Record unavailable' })
    fireEvent.click(screen.getByRole('button', { name: 'Back to Record' }))
    expect(screen.getByRole('button', { name: 'Record Manually' })).toBeInTheDocument()
    await expect(new IndexedDbDrinkingRecordRepository().list()).resolves.toEqual([])
  })
  it('keeps template deletion errors inside the active reference confirmation', async () => {
    const drink = { id:'synthetic-template', drinkType:'beer' as const, drinkName:'Synthetic template', servingVolumeMl:330, abvPercent:5, createdAt:new Date().toISOString(),updatedAt:new Date().toISOString() }
    render(<SavedDrinkPicker referenceCategories={DRINK_REFERENCE_CATEGORIES} savedDrinks={[drink]} selectedSavedDrinkId={null}
      browserActions={{onScan:()=>undefined,onManual:()=>undefined}} onSelect={()=>undefined} onClear={()=>undefined} onUpdate={()=>undefined} onDelete={async()=>{throw new Error('synthetic denial')}} />)
    fireEvent.click(screen.getByRole('button', { name:'My Drinks' }))
    fireEvent.click(screen.getByRole('button', { name:'Delete Synthetic template from My Drinks' }))
    fireEvent.click(screen.getByRole('button', { name:'Yes, delete Synthetic template from My Drinks' }))
    const dialog=screen.getByRole('alertdialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be deleted')
    fireEvent.click(within(dialog).getByRole('button', { name:'Keep Synthetic template' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name:/Synthetic template.*Beer/})).toBeInTheDocument()
  })
  it('keeps history deletion errors in the modal and cancellation preserves the row', async () => {
    const record = { id:'synthetic-record',drinkType:'beer' as const,drinkName:'Synthetic record',servingVolumeMl:330,abvPercent:5,amountConsumed:1,consumedAt:new Date().toISOString(),consumedTimezoneOffsetMinutes:0,createdAt:new Date().toISOString() }
    render(<RecentDrinkingRecords presentation="reference" referenceCategories={DRINK_REFERENCE_CATEGORIES} records={[record]} onUpdate={()=>undefined} onDelete={async()=>{throw new Error('synthetic denial')}} />)
    fireEvent.click(screen.getByRole('button', {name:'Actions for Synthetic record'}))
    fireEvent.click(screen.getByRole('button', {name:'Delete drinking record for Synthetic record'}))
    fireEvent.click(screen.getByRole('button', {name:'Yes, delete record'}))
    const dialog=screen.getByRole('alertdialog')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('could not be deleted')
    fireEvent.click(within(dialog).getByRole('button', {name:'Cancel'}))
    expect(screen.getByRole('heading', {name:'Synthetic record'})).toBeInTheDocument()
  })
})
