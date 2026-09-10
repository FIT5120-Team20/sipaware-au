/**
 * Local 1D barcode decoding from camera/image pixels. No frame, photo or history
 * leaves the browser. ZXing is loaded only when scanning is requested.
 *
 * EAN/UPC, Code 128 and ITF are provisional capture formats, not claims about an
 * absent product catalog. DS must confirm accepted formats and exact strings
 * before a server adapter is enabled. QR codes and label OCR are not supported.
 */
import {
  BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer,
  MultiFormatReader, NotFoundException, ChecksumException, FormatException,
  RGBLuminanceSource,
} from '@zxing/library'

export interface DecodedBarcode { value: string; format: string }
export type DecodeFrame = (source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => Promise<DecodedBarcode | null>

const formats = [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.ITF,
]

/** Bound canvas work while retaining the original decoder string without trims. */
export function createBarcodeDecoder(): DecodeFrame {
  const reader = new MultiFormatReader()
  reader.setHints(new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, formats],
    [DecodeHintType.TRY_HARDER, true],
  ]))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Local image decoding is unavailable')

  return async (source) => {
    const width = source instanceof HTMLVideoElement ? source.videoWidth
      : source instanceof HTMLImageElement ? source.naturalWidth : Number(source.width)
    const height = source instanceof HTMLVideoElement ? source.videoHeight
      : source instanceof HTMLImageElement ? source.naturalHeight : Number(source.height)
    if (!width || !height) return null
    const scale = Math.min(1, 1600 / Math.max(width, height))
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data
    const luminance = new Uint8ClampedArray(canvas.width * canvas.height)
    for (let pixel = 0, offset = 0; pixel < luminance.length; pixel++, offset += 4) {
      luminance[pixel] = (rgba[offset] + 2 * rgba[offset + 1] + rgba[offset + 2]) / 4
    }
    const read = (pixels: Uint8ClampedArray, frameWidth: number, frameHeight: number) => {
      try {
        const result = reader.decodeWithState(new BinaryBitmap(
          new HybridBinarizer(new RGBLuminanceSource(pixels, frameWidth, frameHeight)),
        ))
        const value = result.getText()
        return value.length > 0 && value.length <= 200
          ? { value, format: BarcodeFormat[result.getBarcodeFormat()] } : null
      } catch (error) {
        if (error instanceof NotFoundException || error instanceof ChecksumException ||
            error instanceof FormatException) return null
        throw new Error('Local barcode decoding failed', { cause: error })
      } finally {
        reader.reset()
      }
    }
    const result = read(luminance, canvas.width, canvas.height)
    if (result) return result
    // RGBLuminanceSource cannot rotate itself. A quarter-turn retry lets vertical
    // photo/camera barcodes use the same 1D reader without requiring an upload.
    const rotated = new Uint8ClampedArray(luminance.length)
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        rotated[x * canvas.height + canvas.height - y - 1] = luminance[y * canvas.width + x]
      }
    }
    return read(rotated, canvas.height, canvas.width)
  }
}
