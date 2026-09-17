import { MAX_LABEL_PHOTO_BYTES, MAX_LABEL_UPLOAD_BYTES, prepareLabelPhoto, validateLabelPhoto } from '../../../frontend/src/features/drinks/ocr/labelPhoto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ManualDrinkForm } from '../../../frontend/src/features/drinks/components/ManualDrinkForm'
import { prefillLabelFields, scanDrinkLabel, validateLabelResult, type LabelOcrResult } from '../../../frontend/src/features/drinks/ocr/labelOcr'
import { DRINK_REFERENCE_CATEGORIES } from '../../epic1/frontend/fixtures/drinkReferenceFixture'

const result: LabelOcrResult = {
  fields: { drinkName: 'DEMO PALE ALE', drinkType: 'beer', containerVolumeMl: 375, abvPercent: 4.5 },
  lines: [{ text: 'DEMO PALE ALE', confidence: 0.95, box: [0, 0, 100, 40] }],
  warnings: ['Check the container volume against your serving size.'], elapsedMs: 1500,
}
const file = () => new File(['synthetic test image'], 'label.png', { type: 'image/png' })
const draft = { drinkType: '' as const, drinkName: '', servingSizeSelection: '', customVolumeMl: '',
  abvPercent: '', amountConsumed: '1.5', date: '2026-09-08', time: '20:10' }

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:synthetic') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})
afterEach(() => vi.restoreAllMocks())

function open() {
  const actions = { onSave: vi.fn(), onSaveSavedDrink: vi.fn(), onUpdateSavedDrink: vi.fn(), onDeleteSavedDrink: vi.fn() }
  const view = render(<ManualDrinkForm {...actions} referenceCategories={DRINK_REFERENCE_CATEGORIES}
    referenceStatus="loaded" savedDrinks={[]} onRetryReferenceData={vi.fn()} />)
  return { ...actions, ...view }
}
function upload() {
  fireEvent.change(screen.getByLabelText('Choose a drink label photo'), { target: { files: [file()] } })
}

describe('label OCR form integration', () => {
  it('uses the API result to prefill editable fields without saving or changing consumption', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result)))
    const view = open()
    fireEvent.change(screen.getByLabelText('Number of servings consumed'), { target: { value: '1.5' } })
    upload()
    await screen.findByText(/Scan complete/)
    expect(screen.getByLabelText('Drink name')).toHaveValue('DEMO PALE ALE')
    expect(screen.getByLabelText('Drink type')).toHaveValue('beer')
    expect(screen.getByLabelText('Custom volume (mL)')).toHaveValue(375)
    expect(screen.getByLabelText('ABV (%)')).toHaveValue(4.5)
    expect(screen.getByLabelText('Number of servings consumed')).toHaveValue(1.5)
    fireEvent.change(screen.getByLabelText('Drink name'), { target: { value: 'Corrected name' } })
    expect(screen.getByLabelText('Drink name')).toHaveValue('Corrected name')
    expect(view.onSave).not.toHaveBeenCalled()
    expect(view.onSaveSavedDrink).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith('/api/ocr/drink-label', expect.objectContaining({ method: 'POST', body: expect.any(File), credentials: 'same-origin' }))
  })
  it('keeps values typed during an in-flight scan', async () => {
    let complete!: (value: Response) => void
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { complete = resolve }))
    open(); upload()
    fireEvent.change(screen.getByLabelText('Drink name'), { target: { value: 'My entry' } })
    await act(async () => complete(new Response(JSON.stringify(result))))
    expect(screen.getByLabelText('Drink name')).toHaveValue('My entry')
    expect(screen.getByLabelText('ABV (%)')).toHaveValue(4.5)
  })
  it('cancels pending work and ignores its late response', async () => {
    let complete!: (value: Response) => void
    vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { complete = resolve }))
    open(); upload()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel scan' }))
    await act(async () => complete(new Response(JSON.stringify(result))))
    expect(screen.getByLabelText('Drink name')).toHaveValue('')
    expect(screen.queryByText(/Scan complete/)).not.toBeInTheDocument()
  })
  it('handles unavailable service without clearing user entries', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ detail: 'OCR is unavailable.' }), { status: 503 }))
    open()
    fireEvent.change(screen.getByLabelText('Drink name'), { target: { value: 'My entry' } })
    upload()
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Drink name')).toHaveValue('My entry')
    expect(screen.getByRole('button', { name: 'Scan Another Label' })).toBeEnabled()
  })
  it('releases the selected image and aborts work on unmount', async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    const view = open(); upload()
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic')
  })
})

it('preserves existing values and all occasion fields, including zero', () => {
  const input = { ...draft, drinkName: 'My wine', drinkType: 'wine' as const,
    servingSizeSelection: '150', customVolumeMl: '', abvPercent: '0' }
  expect(prefillLabelFields(input, result)).toEqual(input)
  expect(prefillLabelFields(draft, result)).toMatchObject({ amountConsumed: '1.5', date: draft.date, time: draft.time })
})
it('does not fill missing or ambiguous fields', () => {
  expect(prefillLabelFields(draft, { ...result, fields: { drinkName: null, drinkType: null, containerVolumeMl: null, abvPercent: null } })).toEqual(draft)
})
it('rejects malformed responses and unsupported uploads', async () => {
  expect(() => validateLabelResult({ ...result, fields: { ...result.fields, abvPercent: 110 } })).toThrow()
  await expect(scanDrinkLabel(new File(['x'], 'photo.heic', { type: 'image/heic' }), new AbortController().signal)).rejects.toThrow('JPEG')
  await expect(scanDrinkLabel(new File([new Uint8Array(MAX_LABEL_PHOTO_BYTES + 1)], 'large.png', { type: 'image/png' }),
    new AbortController().signal)).rejects.toThrow('10 MB')
  expect(fetch).not.toHaveBeenCalled()
})

// Canvas/decoding are browser APIs: unit tests control their outcomes; real-browser
// checks separately verify actual encoding and OCR readability for large photos.
describe('large label photo preparation', () => {
  const large = (size = MAX_LABEL_PHOTO_BYTES) => new File([new Uint8Array(size)], 'large.png', { type: 'image/png' })
  function decoding(mode: 'loaded' | 'error' | 'pending' = 'loaded') {
    const image = document.createElement('img')
    Object.defineProperties(image, { naturalWidth: { value: 4000 }, naturalHeight: { value: 3000 },
      src: { set(value: string) {
        if (!value || mode === 'pending') return
        queueMicrotask(() => { if (mode === 'error') image.onerror?.(new Event('error')); else image.onload?.(new Event('load')) })
      } } })
    vi.spyOn(globalThis, 'Image').mockImplementation(function () { return image })
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['compressed'], { type: 'image/jpeg' })))
    return { context, encode }
  }
  it('accepts exactly 10 MiB, rejects larger/empty photos, and preserves 4 MiB bytes', async () => {
    expect(() => validateLabelPhoto(large())).not.toThrow()
    expect(() => validateLabelPhoto(large(MAX_LABEL_PHOTO_BYTES + 1))).toThrow('10 MB')
    expect(() => validateLabelPhoto(large(0))).toThrow('Choose a photo first')
    const original = large(MAX_LABEL_UPLOAD_BYTES)
    expect(await prepareLabelPhoto(original, new AbortController().signal)).toBe(original)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it('compresses a 10 MiB photo and uploads JPEG with the existing same-origin session', async () => {
    const { context, encode } = decoding()
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result)))
    await scanDrinkLabel(large(), new AbortController().signal)
    const options = vi.mocked(fetch).mock.calls[0][1]!
    const body = options.body as File
    expect(body.type).toBe('image/jpeg')
    expect(body.size).toBeLessThanOrEqual(MAX_LABEL_UPLOAD_BYTES)
    expect(options.credentials).toBe('same-origin')
    expect(options.headers).toEqual({ 'Content-Type': 'image/jpeg', Accept: 'application/json' })
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(HTMLImageElement), 0, 0, 2400, 1800)
    expect(encode).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92)
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
  it('reduces quality when needed and never uploads a body above the transport limit', async () => {
    const { encode } = decoding()
    encode.mockImplementationOnce(callback => callback(new Blob([new Uint8Array(MAX_LABEL_UPLOAD_BYTES + 1)])))
    const prepared = await prepareLabelPhoto(large(), new AbortController().signal)
    expect(prepared.size).toBeLessThanOrEqual(MAX_LABEL_UPLOAD_BYTES)
    expect(encode).toHaveBeenNthCalledWith(2, expect.any(Function), 'image/jpeg', 0.82)
  })
  it('shows a read error for a malformed large image without uploading it', async () => {
    decoding('error')
    await expect(scanDrinkLabel(large(), new AbortController().signal)).rejects.toThrow('Could not read this photo')
    expect(fetch).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
  it('cancels during decoding and releases the temporary photo URL without uploading', async () => {
    decoding('pending')
    const controller = new AbortController()
    const pending = scanDrinkLabel(large(), controller.signal)
    controller.abort(new Error('Cancelled'))
    await expect(pending).rejects.toThrow('Cancelled')
    expect(fetch).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
  it('ignores encoded output arriving after cancellation', async () => {
    const { encode } = decoding()
    const controller = new AbortController()
    encode.mockImplementation(callback => { controller.abort(new Error('Cancelled')); callback(new Blob(['late'])) })
    await expect(scanDrinkLabel(large(), controller.signal)).rejects.toThrow('Cancelled')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps a usable preview for large supported photos and rejects oversize photos in the UI', async () => {
    decoding(); vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(result)))
    const view = open()
    fireEvent.change(screen.getByLabelText('Choose a drink label photo'), { target: { files: [large()] } })
    await screen.findByText(/Scan complete/)
    expect(screen.getByAltText('Selected label: large.png')).toBeInTheDocument()
    expect(screen.getByText('JPEG, PNG or WebP. Maximum photo size: 10 MB.')).toBeInTheDocument()
    expect(view.onSave).not.toHaveBeenCalled()
    vi.mocked(fetch).mockClear()
    fireEvent.change(screen.getByLabelText('Choose a drink label photo'), { target: { files: [large(MAX_LABEL_PHOTO_BYTES + 1)] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('10 MB')
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Drink name')).toHaveValue('DEMO PALE ALE')
  })
})
