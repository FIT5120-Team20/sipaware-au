/**
 * Controlled browser-resource tests isolate cancellation and the 15-second rule.
 * Stub streams/decoders prove lifecycle behavior, not physical-device permission
 * support or real barcode decoding; separate browser tests exercise actual pixels.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureCamera, capturePhoto } from '../../../frontend/src/features/drinks/barcode/barcodeCapture'
import type { DecodedBarcode } from '../../../frontend/src/features/drinks/barcode/barcodeDecoder'

const code: DecodedBarcode = { value: '000000000001', format: 'EAN_13' }
function cameraCase() {
  const video = document.createElement('video')
  Object.defineProperty(video, 'readyState', { value: 4 })
  vi.spyOn(video, 'play').mockResolvedValue()
  const stop = vi.fn(), stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
  const getUserMedia = vi.fn().mockResolvedValue(stream)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  const owner = new AbortController()
  const events = { onReady: vi.fn(), onGuidance: vi.fn(), onDecoded: vi.fn(), onError: vi.fn() }
  return { video, stop, stream, getUserMedia, owner, events }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('US 3.1 camera ownership', () => {
  it.each(['undecided', 'already-granted'])('AC 2 / AC 3: automatically requests video using the browser when %s', async () => {
    const c = cameraCase()
    await captureCamera({ video: c.video, signal: c.owner.signal, decode: vi.fn().mockResolvedValue(null), ...c.events })
    expect(c.getUserMedia).toHaveBeenCalledOnce()
    expect(c.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    expect(c.events.onReady).toHaveBeenCalledOnce()
    c.owner.abort()
    expect(c.stop).toHaveBeenCalledOnce()
    expect(c.video.srcObject).toBeNull()
  })
  it('AC 4: denied camera stops resource work and reports the camera boundary', async () => {
    const c = cameraCase(); c.getUserMedia.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    const decode = vi.fn()
    await captureCamera({ video: c.video, signal: c.owner.signal, decode, ...c.events })
    expect(c.events.onError).toHaveBeenCalledWith('camera')
    expect(c.events.onReady).not.toHaveBeenCalled()
    expect(decode).not.toHaveBeenCalled()
  })
  it('AC 5: one decoded frame stops tracks and prevents duplicate lookup callbacks', async () => {
    const c = cameraCase(), decode = vi.fn().mockResolvedValue(code)
    await captureCamera({ video: c.video, signal: c.owner.signal, decode, ...c.events })
    await vi.advanceTimersByTimeAsync(2000)
    expect(c.events.onDecoded).toHaveBeenCalledExactlyOnceWith(code)
    expect(c.stop).toHaveBeenCalledOnce()
    expect(decode).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('AC 7: guidance appears at 15 seconds, scanning continues and late detection succeeds', async () => {
    const c = cameraCase()
    let result: DecodedBarcode | null = null
    const decode = vi.fn(async () => result)
    await captureCamera({ video: c.video, signal: c.owner.signal, decode, ...c.events })
    await vi.advanceTimersByTimeAsync(14999)
    expect(c.events.onGuidance).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(c.events.onGuidance).toHaveBeenCalledOnce()
    expect(c.stop).not.toHaveBeenCalled()
    const calls = decode.mock.calls.length
    await vi.advanceTimersByTimeAsync(500)
    expect(decode.mock.calls.length).toBeGreaterThan(calls)
    result = code
    await vi.advanceTimersByTimeAsync(250)
    expect(c.events.onDecoded).toHaveBeenCalledExactlyOnceWith(code)
    expect(c.stop).toHaveBeenCalledOnce()
  })
  it('a camera grant after Back is stopped without making the preview active', async () => {
    const c = cameraCase()
    let grant!: (stream: MediaStream) => void
    c.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => { grant = resolve }))
    const pending = captureCamera({ video: c.video, signal: c.owner.signal, decode: vi.fn(), ...c.events })
    c.owner.abort(); grant(c.stream); await pending
    expect(c.stop).toHaveBeenCalledOnce()
    expect(c.events.onReady).not.toHaveBeenCalled()
  })
  it('a decoder result after Back cannot trigger lookup', async () => {
    const c = cameraCase()
    let finish!: (result: DecodedBarcode) => void
    const decode = vi.fn(() => new Promise<DecodedBarcode>((resolve) => { finish = resolve }))
    await captureCamera({ video: c.video, signal: c.owner.signal, decode, ...c.events })
    c.owner.abort(); finish(code)
    await vi.advanceTimersByTimeAsync(1000)
    expect(c.events.onDecoded).not.toHaveBeenCalled()
    expect(c.stop).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('technical decoder failure is not a lookup miss or continued active camera', async () => {
    const c = cameraCase()
    await captureCamera({ video: c.video, signal: c.owner.signal, decode: vi.fn().mockRejectedValue(new Error('failure')), ...c.events })
    await vi.advanceTimersByTimeAsync(1)
    expect(c.events.onError).toHaveBeenCalledWith('decoder')
    expect(c.stop).toHaveBeenCalledOnce()
    expect(c.events.onDecoded).not.toHaveBeenCalled()
  })
})
describe('US 3.1 photo ownership', () => {
  function imageCase() {
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:synthetic-private-photo')
      static revokeObjectURL = vi.fn()
    })
    Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: vi.fn().mockResolvedValue(undefined) })
    return new File(['synthetic image bytes'], 'test.png', { type: 'image/png' })
  }
  it('AC 8: hands decoded strings back and always revokes the selected image URL', async () => {
    const file = imageCase(), decode = vi.fn().mockResolvedValue(code)
    await expect(capturePhoto(file, new AbortController().signal, decode)).resolves.toEqual(code)
    expect(decode).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-private-photo')
  })
  it('AC 9: no decoded barcode is distinct from a lookup result', async () => {
    const file = imageCase()
    await expect(capturePhoto(file, new AbortController().signal, vi.fn().mockResolvedValue(null))).resolves.toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })
  it('invalid image types do not create URLs or call the decoder', async () => {
    imageCase(); const decode = vi.fn()
    await expect(capturePhoto(new File(['x'], 'x.txt', { type: 'text/plain' }), new AbortController().signal, decode)).resolves.toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(decode).not.toHaveBeenCalled()
  })
  it('replacing or leaving a pending photo revokes its URL', async () => {
    const file = imageCase(), owner = new AbortController()
    let finish!: () => void
    vi.mocked(HTMLImageElement.prototype.decode).mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    const pending = capturePhoto(file, owner.signal, vi.fn())
    owner.abort(); finish()
    await expect(pending).rejects.toThrow()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })
})
