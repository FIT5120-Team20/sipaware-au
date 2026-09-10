/**
 * Owns one camera or photo attempt and releases every browser resource on exit.
 * An AbortSignal is the attempt identity: late camera grants, decoder results
 * and image work from a previous attempt cannot update a newer scanner view.
 * This module captures video only and has no network or persistence capability.
 */
import type { DecodeFrame, DecodedBarcode } from './barcodeDecoder'

interface CameraOptions {
  video: HTMLVideoElement
  signal: AbortSignal
  decode: DecodeFrame
  onReady: () => void
  onGuidance: () => void
  onDecoded: (barcode: DecodedBarcode) => void
  onError: (kind: 'camera' | 'decoder') => void
}

/**
 * Start detection after the preview is playing. The 15-second timer supplies
 * guidance only: detection continues until a code is read or the owner leaves.
 * Recursive timeouts serialize decoding so repeated frames cannot issue lookups.
 */
export async function captureCamera(options: CameraOptions): Promise<void> {
  const { video, signal, decode, onReady, onGuidance, onDecoded, onError } = options
  let stream: MediaStream | undefined
  let loop: ReturnType<typeof setTimeout> | undefined
  const timers: { guidance?: ReturnType<typeof setTimeout> } = {}
  let stopped = false
  const cleanup = () => {
    stopped = true
    clearTimeout(loop)
    clearTimeout(timers.guidance)
    stream?.getTracks().forEach((track) => track.stop())
    video.srcObject = null
    signal.removeEventListener('abort', cleanup)
  }
  if (signal.aborted) return
  signal.addEventListener('abort', cleanup, { once: true })
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable')
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false,
    })
    if (signal.aborted || stopped) { cleanup(); return }
    video.srcObject = stream
    await video.play()
    if (signal.aborted || stopped) { cleanup(); return }
  } catch {
    cleanup()
    if (!signal.aborted) onError('camera')
    return
  }
  onReady()
  timers.guidance = setTimeout(() => {
    if (!stopped && !signal.aborted) onGuidance()
  }, 15000)
  const detect = async () => {
    if (stopped || signal.aborted) return
    try {
      const result = video.readyState >= 2 ? await decode(video) : null
      if (stopped || signal.aborted) return
      if (result) {
        cleanup()
        onDecoded(result)
        return
      }
    } catch {
      cleanup()
      if (!signal.aborted) onError('decoder')
      return
    }
    loop = setTimeout(() => { void detect() }, 250)
  }
  void detect()
}

/** Release an image URL even when replaced, cancelled, unreadable or rejected. */
export async function capturePhoto(
  file: File,
  signal: AbortSignal,
  decode: DecodeFrame,
): Promise<DecodedBarcode | null> {
  signal.throwIfAborted()
  if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) {
    return null
  }
  const image = new Image()
  const url = URL.createObjectURL(file)
  let released = false
  const cleanup = () => {
    if (released) return
    released = true
    image.src = ''
    URL.revokeObjectURL(url)
  }
  signal.addEventListener('abort', cleanup, { once: true })
  try {
    image.src = url
    try { await image.decode() } catch { signal.throwIfAborted(); return null }
    signal.throwIfAborted()
    if (image.naturalWidth * image.naturalHeight > 40000000) {
      return null
    }
    return await decode(image)
  } finally {
    signal.removeEventListener('abort', cleanup)
    cleanup()
  }
}
