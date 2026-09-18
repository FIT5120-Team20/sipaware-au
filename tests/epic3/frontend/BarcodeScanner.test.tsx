/**
 * Synthetic UI/Record-flow tests cover every US 3.1 transition without presenting
 * mocks as a production catalog. Camera ownership and real pixel decoding are
 * validated separately; only the resource boundary is controlled in this suite.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BarcodeScanner } from '../../../frontend/src/features/drinks/components/BarcodeScanner'
import { ManualDrinkForm } from '../../../frontend/src/features/drinks/components/ManualDrinkForm'
import { captureCamera, capturePhoto } from '../../../frontend/src/features/drinks/barcode/barcodeCapture'
import { DRINK_REFERENCE_CATEGORIES } from '../../epic1/frontend/fixtures/drinkReferenceFixture'
import type { BarcodeProduct } from '../../../frontend/src/features/drinks/barcode/barcodeLookup'

vi.mock('../../../frontend/src/features/drinks/barcode/barcodeCapture', () => ({
  captureCamera: vi.fn(), capturePhoto: vi.fn(),
}))
const code = { value: '000000000001', format: 'EAN_13' }
const product: BarcodeProduct = {
  productId: 'synthetic-only', barcode: code.value, drinkName: 'Synthetic barcode drink',
  drinkType: 'beer', volumeMl: 330, abvPercent: 5, sourceName: 'Synthetic test source',
  sourceUrl: 'https://example.org/source', packQuantity: 6, totalPackageVolumeMl: 1980,
}
let camera: Parameters<typeof captureCamera>[0]
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true, value() { this.setAttribute('open', '') },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true, value() { this.removeAttribute('open') },
  })
  vi.mocked(captureCamera).mockImplementation(async (options) => { camera = options })
  vi.mocked(capturePhoto).mockResolvedValue(null)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function open(lookup = vi.fn().mockResolvedValue({ kind: 'match', product })) {
  const callbacks = { onBack: vi.fn(), onUseDrink: vi.fn(), onAddManually: vi.fn() }
  const rendered = render(<BarcodeScanner {...callbacks} lookup={lookup} />)
  return { ...callbacks, ...rendered, lookup }
}
async function detected() {
  await act(async () => { camera.onReady(); camera.onDecoded(code) })
}
function click(name: string) { fireEvent.click(screen.getByRole('button', { name, exact: true })) }

describe('US 3.1 scanner states with an explicit synthetic lookup', () => {
  it('AC 1: starts capture automatically and scanner Back returns to Record', () => {
    const c = open()
    expect(captureCamera).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog', { name: 'Scan Barcode' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose Photo' })).toBeVisible()
    click('Back to Record')
    expect(c.onBack).toHaveBeenCalledOnce()
    expect(camera.signal.aborted).toBe(true)
  })
  it('AC 2 / AC 3: active preview and guide appear after the browser camera is ready', () => {
    open(); act(() => camera.onReady())
    expect(screen.getByLabelText('Live camera preview')).toHaveClass('barcode-video')
    expect(document.querySelector('.barcode-scan-frame')).not.toBeNull()
    expect(screen.getByText('Position the barcode fully inside the scanning area.')).toBeVisible()
  })
  it('AC 4: denial has inactive dark-camera styling, no frame and a working photo button', () => {
    open(); act(() => camera.onError('camera'))
    expect(screen.getByText('Camera access wasn’t granted')).toBeVisible()
    expect(screen.getByLabelText('Live camera preview')).toHaveClass('barcode-video--inactive')
    expect(document.querySelector('.barcode-scan-frame')).toBeNull()
    const input = screen.getByLabelText('Choose a barcode photo'), picker = vi.spyOn(input, 'click')
    click('Choose Photo'); expect(picker).toHaveBeenCalledOnce()
  })
  it('AC 5: reviews exact synthetic details and Use This Drink selects only once', async () => {
    const c = open(); await detected()
    expect(screen.getByText(product.drinkName)).toBeVisible()
    expect(screen.getByText('Beer · 5% ABV · 330 mL per container')).toBeVisible()
    expect(c.lookup.mock.calls[0][0]).toBe(code.value)
    expect(c.lookup.mock.calls[0]).toHaveLength(2)
    click('Use This Drink'); click('Use This Drink')
    expect(c.onUseDrink).toHaveBeenCalledExactlyOnceWith(product)
    expect(c.onAddManually).not.toHaveBeenCalled()
  })
  it('AC 6: Scan Again starts a fresh attempt and clears guidance', async () => {
    open(); act(() => camera.onGuidance()); await detected()
    click('Scan Again')
    expect(captureCamera).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Having trouble scanning?')).not.toBeInTheDocument()
  })
  it('AC 7: additional guidance stays within the active scanner', () => {
    open(); act(() => { camera.onReady(); camera.onGuidance() })
    expect(screen.getByText('Having trouble scanning?')).toBeVisible()
    expect(screen.getByText(/Scanning continues automatically/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Choose Photo' })).toBeVisible()
    expect(camera.signal.aborted).toBe(false)
  })
  it('AC 8: a photo uses the same exact lookup and review-to-Record handoff', async () => {
    const c = open(); vi.mocked(capturePhoto).mockResolvedValue(code)
    fireEvent.change(screen.getByLabelText('Choose a barcode photo'), { target: { files: [new File(['synthetic'], 'barcode.png', { type: 'image/png' })] } })
    await screen.findByText(product.drinkName)
    expect(c.lookup.mock.calls[0][0]).toBe(code.value)
    click('Use This Drink'); expect(c.onUseDrink).toHaveBeenCalledWith(product)
  })
  it.each(['requesting', 'active', 'denied'])('AC 8: cancelling the photo picker keeps the %s scanner and its camera owner', async (state) => {
    const c = open(), signal = camera.signal
    if (state === 'active') act(() => camera.onReady())
    if (state === 'denied') act(() => camera.onError('camera'))
    const input = screen.getByLabelText('Choose a barcode photo')
    const picker = vi.spyOn(input, 'click')
    click('Choose Photo')
    // Native file-picker cancellation bubbles; it is not the dialog's Escape event.
    fireEvent(input, new Event('cancel', { bubbles: true }))
    expect(c.onBack).not.toHaveBeenCalled()
    expect(c.onUseDrink).not.toHaveBeenCalled()
    expect(c.onAddManually).not.toHaveBeenCalled()
    expect(c.lookup).not.toHaveBeenCalled()
    expect(capturePhoto).not.toHaveBeenCalled()
    expect(captureCamera).toHaveBeenCalledOnce()
    expect(signal.aborted).toBe(false)
    expect(screen.getByRole('dialog', { name: 'Scan Barcode' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Back to Record' })).toBeVisible()
    if (state === 'active') expect(document.querySelector('.barcode-scan-frame')).not.toBeNull()
    if (state === 'denied') expect(screen.getByText('Camera access wasn’t granted')).toBeVisible()
    click('Choose Photo'); expect(picker).toHaveBeenCalledTimes(2)
    vi.mocked(capturePhoto).mockResolvedValue(code)
    fireEvent.change(input, { target: { files: [new File(['synthetic'], 'barcode.png', { type: 'image/png' })] } })
    await screen.findByText(product.drinkName)
    click('Use This Drink'); expect(c.onUseDrink).toHaveBeenCalledExactlyOnceWith(product)
  })
  it('AC 9: cancelling Choose Another Photo retains the unreadable result and allows a later photo', async () => {
    const c = open(), input = screen.getByLabelText('Choose a barcode photo')
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.png', { type: 'image/png' })] } })
    await screen.findByText('We couldn’t read the barcode')
    click('Choose Another Photo')
    fireEvent(input, new Event('cancel', { bubbles: true }))
    expect(screen.getByText('We couldn’t read the barcode')).toBeVisible()
    expect(captureCamera).toHaveBeenCalledOnce()
    expect(capturePhoto).toHaveBeenCalledOnce()
    expect(c.onBack).not.toHaveBeenCalled()
    expect(c.lookup).not.toHaveBeenCalled()
    vi.mocked(capturePhoto).mockResolvedValue(code)
    click('Choose Another Photo')
    fireEvent.change(input, { target: { files: [new File(['synthetic'], 'good.png', { type: 'image/png' })] } })
    await screen.findByText(product.drinkName)
    expect(c.lookup.mock.calls[0][0]).toBe(code.value)
  })
  it('AC 1 / AC 12: actual dialog cancellation still returns from result to scanner, then to Record', async () => {
    const c = open(); await detected()
    const dialog = screen.getByRole('dialog', { name: 'Scan Barcode' })
    const resultCancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, resultCancel)
    expect(resultCancel.defaultPrevented).toBe(true)
    expect(c.onBack).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Back to Record' })).toBeVisible()
    expect(captureCamera).toHaveBeenCalledTimes(2)
    const signal = camera.signal, scannerCancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, scannerCancel)
    expect(scannerCancel.defaultPrevented).toBe(true)
    expect(c.onBack).toHaveBeenCalledOnce()
    expect(signal.aborted).toBe(true)
  })
  it('AC 9: unreadable photo explains recovery and reopens the picker', async () => {
    const c = open()
    const input = screen.getByLabelText('Choose a barcode photo')
    fireEvent.change(input, { target: { files: [new File(['bad'], 'barcode.png', { type: 'image/png' })] } })
    await screen.findByText('We couldn’t read the barcode')
    expect(c.lookup).not.toHaveBeenCalled()
    const picker = vi.spyOn(input, 'click'); click('Choose Another Photo')
    expect(picker).toHaveBeenCalledOnce()
  })
  it('AC 10 / AC 11: confirmed synthetic miss has manual fallback and a new scan', async () => {
    const c = open(vi.fn().mockResolvedValue({ kind: 'not-found' })); await detected()
    expect(screen.getByText('Drink not found')).toBeVisible()
    expect(screen.getByText('We couldn’t find a matching drink in our database.')).toBeVisible()
    expect(screen.queryByText(product.drinkName)).not.toBeInTheDocument()
    click('Add Drink Manually'); expect(c.onAddManually).toHaveBeenCalledOnce()
    click('Scan Another Barcode'); expect(captureCamera).toHaveBeenCalledTimes(2)
  })
  it.each(['match', 'not-found', 'photo-unreadable'])('AC 12: page Back from %s returns to scanner, not Record', async (kind) => {
    const c = open(vi.fn().mockResolvedValue(kind === 'match' ? { kind, product } : { kind }))
    if (kind === 'photo-unreadable') {
      fireEvent.change(screen.getByLabelText('Choose a barcode photo'), { target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] } })
      await screen.findByText('We couldn’t read the barcode')
    } else await detected()
    click('Back to Barcode Scanner')
    expect(c.onBack).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Back to Record' })).toBeVisible()
    expect(captureCamera).toHaveBeenCalledTimes(2)
  })
  it.each(['unavailable', 'network', 'wrong-product'])('does not label %s as Drink not found', async (kind) => {
    const lookup = kind === 'network' ? vi.fn().mockRejectedValue(new Error('Synthetic service error'))
      : vi.fn().mockResolvedValue(kind === 'unavailable' ? { kind } : { kind: 'match', product: { ...product, barcode: 'another-code' } })
    open(lookup); await detected()
    expect(screen.queryByText('Drink not found')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Use This Drink' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Drink Manually' })).toBeVisible()
  })
  it('discarded asynchronous lookup cannot replace a new scanner view', async () => {
    let complete!: (value: unknown) => void
    const lookup = vi.fn(() => new Promise((resolve) => { complete = resolve }))
    open(lookup); await detected()
    click('Back to Barcode Scanner')
    expect(lookup.mock.calls[0][1].aborted).toBe(true)
    await act(async () => complete({ kind: 'match', product }))
    expect(screen.queryByText(product.drinkName)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Record' })).toBeVisible()
  })
  it('unmount cancels the active operation', () => {
    const c = open(), signal = camera.signal
    c.unmount(); expect(signal.aborted).toBe(true)
  })
})

describe('Catalog packaging and provenance', () => {
  it('shows a multipack separately from the single-container volume', async () => {
    open(); await detected()
    expect(screen.getByText(/330 mL per container/)).toBeVisible()
    expect(screen.getByText(/pack of 6 containers/)).toBeVisible()
    expect(screen.getByRole('link', { name: product.sourceName })).toHaveAttribute('href', product.sourceUrl)
  })
})

describe('US 3.1 integration follows main draft resets and preserves the explicit save boundary', () => {
  it('Back abandons the draft; scanner cancellation and product selection never save a record', async () => {
    const callbacks = { onSave: vi.fn(), onSaveSavedDrink: vi.fn(), onUpdateSavedDrink: vi.fn(), onDeleteSavedDrink: vi.fn() }
    render(<ManualDrinkForm startInBrowse referenceCategories={DRINK_REFERENCE_CATEGORIES} referenceStatus="loaded"
      onRetryReferenceData={vi.fn()} savedDrinks={[]} {...callbacks}
      barcodeLookup={vi.fn().mockResolvedValue({ kind: 'match', product })} />)
    click('Got it')
    click('Record Manually')
    fireEvent.change(screen.getByLabelText('Drink name'), { target: { value: 'Unsaved draft' } })
    fireEvent.change(screen.getByLabelText('Number of servings consumed'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-08' } })
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '20:10' } })
    expect(screen.getByRole('heading', { name: 'Scan drink label' })).toBeVisible()
    click('Scan Label')
    expect(screen.getByLabelText('Choose a drink label photo')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(captureCamera).not.toHaveBeenCalled()
    expect(capturePhoto).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Drink name')).toHaveValue('Unsaved draft')
    click('Back to Record')
    click('Scan Barcode')
    fireEvent(screen.getByLabelText('Choose a barcode photo'), new Event('cancel', { bubbles: true }))
    expect(screen.getByRole('dialog', { name: 'Scan Barcode' })).toBeVisible()
    click('Back to Record')
    // main treats leaving manual entry as abandoning the occasion, not saving it.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Drink name')).toHaveValue('')
    expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(null)
    for (const action of Object.values(callbacks)) expect(action).not.toHaveBeenCalled()
    click('Scan Barcode'); await detected(); click('Use This Drink')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Drink name')).toHaveValue(product.drinkName)
    expect(screen.getByLabelText('Custom volume (mL)')).toHaveValue(330)
    expect(screen.getByLabelText('ABV (%)')).toHaveValue(5)
    expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(null)
    expect(screen.getByLabelText('Date')).not.toHaveValue('2026-09-08')
    expect(screen.getByLabelText('Date')).not.toHaveValue('')
    expect(screen.getByLabelText('Time')).not.toHaveValue('')
    for (const action of Object.values(callbacks)) expect(action).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Record Drink' })).toBeVisible()
    expect(screen.queryByText(/^(Now|Earlier)$/)).not.toBeInTheDocument()
  })
})
