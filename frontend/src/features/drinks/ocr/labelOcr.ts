import { MAX_LABEL_UPLOAD_BYTES, prepareLabelPhoto, validateLabelPhoto } from './labelPhoto'
import { buildApiUrl } from '../../../services/apiBaseUrl'
import { isDrinkType } from '../config/drinkTypes'
import type { DrinkType } from '../types/drinkingRecord'
import { CUSTOM_SERVING_SIZE, type ManualDrinkFormValues } from '../types/manualDrinkForm'

export interface LabelOcrResult {
  fields: {
    drinkName: string | null
    drinkType: DrinkType | null
    containerVolumeMl: number | null
    abvPercent: number | null
  }
  lines: { text: string; confidence: number; box: number[] }[]
  warnings: string[]
  elapsedMs: number
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

export function validateLabelResult(value: unknown): LabelOcrResult {
  if (!object(value) || !object(value.fields)) throw new Error('Invalid OCR response.')
  const fields = value.fields
  if (
    !(fields.drinkName === null || (typeof fields.drinkName === 'string' && fields.drinkName.trim().length > 0 && fields.drinkName.length <= 200)) ||
    !(fields.drinkType === null || isDrinkType(fields.drinkType)) ||
    !(fields.containerVolumeMl === null || (finite(fields.containerVolumeMl, 0, 100000) && fields.containerVolumeMl > 0)) ||
    !(fields.abvPercent === null || finite(fields.abvPercent, 0, 100)) ||
    !Array.isArray(value.lines) || !value.lines.every(line => object(line) && typeof line.text === 'string' &&
      finite(line.confidence, 0, 1) && Array.isArray(line.box) && line.box.length === 4 && line.box.every(n => finite(n, -100000, 100000))) ||
    !Array.isArray(value.warnings) || !value.warnings.every(note => typeof note === 'string') ||
    !finite(value.elapsedMs, 0, Number.MAX_SAFE_INTEGER)
  ) throw new Error('Invalid OCR response. Your entries have been kept.')
  return value as unknown as LabelOcrResult
}

export async function scanDrinkLabel(file: File, signal: AbortSignal): Promise<LabelOcrResult> {
  validateLabelPhoto(file)
  signal.throwIfAborted()
  const request = new AbortController()
  const cancel = () => request.abort(signal.reason)
  signal.addEventListener('abort', cancel, { once: true })
  const timeout = window.setTimeout(() => request.abort(new Error('Scanning took too long. Try a smaller photo.')), 120000)
  try {
    const upload = file.size > MAX_LABEL_UPLOAD_BYTES ? await prepareLabelPhoto(file, request.signal) : file
    request.signal.throwIfAborted()
    // Send the website session only to this origin; the OCR service token stays on the server.
    const response = await fetch(buildApiUrl('/api/ocr/drink-label'), {
      method: 'POST', body: upload, signal: request.signal, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': upload.type, Accept: 'application/json' },
    })
    const result: unknown = await response.json()
    if (!response.ok) throw new Error(object(result) && typeof result.detail === 'string'
      ? result.detail : 'Label scanning is unavailable. You can still enter the details manually.')
    return validateLabelResult(result)
  } catch (error) {
    if (signal.aborted) throw signal.reason
    if (request.signal.aborted) throw request.signal.reason
    if (error instanceof TypeError || error instanceof SyntaxError) {
      throw new Error('Could not reach label scanning. Check the local backend and try again.', { cause: error })
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
  }
}

/** Preserve all occasion fields and user-entered values, including numeric zero. */
export function prefillLabelFields(current: ManualDrinkFormValues, result: LabelOcrResult): ManualDrinkFormValues {
  const { fields } = result
  const next = { ...current }
  if (!current.drinkName.trim() && fields.drinkName) next.drinkName = fields.drinkName
  if (!current.drinkType && fields.drinkType) next.drinkType = fields.drinkType
  if (!current.abvPercent.trim() && fields.abvPercent !== null) next.abvPercent = String(fields.abvPercent)
  if ((!current.servingSizeSelection || current.servingSizeSelection === CUSTOM_SERVING_SIZE) &&
    !current.customVolumeMl.trim() && fields.containerVolumeMl !== null) {
    next.servingSizeSelection = CUSTOM_SERVING_SIZE
    next.customVolumeMl = String(fields.containerVolumeMl)
  }
  return next
}
