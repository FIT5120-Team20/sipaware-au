/** Browser-only preparation: allow 10 MiB photos while keeping the authenticated
 * OCR request within 4 MiB, below Vercel's 4.5 MB limit. Images stay in memory;
 * this module does not own model access, credentials or saved drinking records.
 */
export const MAX_LABEL_PHOTO_BYTES = 10 * 1024 * 1024
export const MAX_LABEL_UPLOAD_BYTES = 4 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateLabelPhoto(file: File): void {
  if (!TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.')
  if (!file.size) throw new Error('Choose a photo first.')
  if (file.size > MAX_LABEL_PHOTO_BYTES) throw new Error('Choose a photo of 10 MB or less.')
}

/** Decode with a temporary object URL and release it on success, error or cancel.
 * Browser decoding applies camera orientation before the pixels are drawn.
 */
function readPhoto(file: File, signal: AbortSignal): Promise<HTMLImageElement> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    const cleanup = () => {
      image.onload = null
      image.onerror = null
      signal.removeEventListener('abort', cancel)
      URL.revokeObjectURL(url)
    }
    const cancel = () => { cleanup(); image.src = ''; reject(signal.reason) }
    image.onload = () => { cleanup(); resolve(image) }
    image.onerror = () => { cleanup(); reject(new Error('Could not read this photo. Try another JPEG, PNG or WebP image.')) }
    signal.addEventListener('abort', cancel, { once: true })
    image.src = url
  })
}

/** Keep small files byte-for-byte. Large photos use a bounded canvas with the
 * original aspect ratio and high JPEG quality first. Recheck cancellation after
 * each asynchronous step so cancelled work cannot reach the upload request.
 */
export async function prepareLabelPhoto(file: File, signal: AbortSignal): Promise<File> {
  validateLabelPhoto(file)
  signal.throwIfAborted()
  if (file.size <= MAX_LABEL_UPLOAD_BYTES) return file
  const image = await readPhoto(file, signal)
  signal.throwIfAborted()
  const width = image.naturalWidth, height = image.naturalHeight
  if (!width || !height) throw new Error('Could not read this photo. Try another image.')
  const canvas = document.createElement('canvas')
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this photo. Try a smaller image.')
    for (const longestEdge of [2400, 1800, 1350]) {
      const scale = Math.min(1, longestEdge / Math.max(width, height))
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      // White preserves label text when converting transparent images to JPEG.
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.92, 0.82, 0.7]) {
        signal.throwIfAborted()
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
        signal.throwIfAborted()
        if (!blob) throw new Error('Could not prepare this photo. Try another image.')
        if (blob.size > 0 && blob.size <= MAX_LABEL_UPLOAD_BYTES) {
          return new File([blob], 'label.jpg', { type: 'image/jpeg' })
        }
      }
    }
    throw new Error('Could not prepare this photo for scanning. Try a closer photo of the label.')
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}
