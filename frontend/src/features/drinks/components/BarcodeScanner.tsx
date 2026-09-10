/**
 * US 3.1 capture/result interface within the existing Record route.
 *
 * Native dialog makes the underlying form inert while keeping unsaved inputs.
 * Back/Escape goes from results to scanner, then from scanner to Record.
 * The default lookup reports the deferred catalog honestly. Presentation adapts
 * the approved prototype f5711b15a939d635a2019562389b32b4ced4a6ef; no mock catalog,
 * persistence code or prototype control is imported.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { captureCamera, capturePhoto } from '../barcode/barcodeCapture'
import type { DecodeFrame, DecodedBarcode } from '../barcode/barcodeDecoder'
import { lookupBarcode, validateLookupResult, type BarcodeLookup, type BarcodeProduct } from '../barcode/barcodeLookup'
import { getDrinkTypeLabel } from '../config/drinkTypes'
import '../barcodeScanner.css'

type View =
  | { kind: 'scanner' }
  | { kind: 'photo-processing' }
  | { kind: 'lookup'; barcode: string }
  | { kind: 'match'; product: BarcodeProduct }
  | { kind: 'not-found' }
  | { kind: 'photo-unreadable' }
  | { kind: 'unavailable'; barcode: string }
  | { kind: 'error'; area: 'decoder' | 'lookup' }

interface Props {
  onBack: () => void
  onUseDrink: (product: BarcodeProduct) => void
  onAddManually: () => void
  lookup?: BarcodeLookup
  decode?: DecodeFrame
}

// Local code splitting keeps the decoder out of ordinary Record visits.
let decoder: Promise<DecodeFrame> | undefined
const decodeLocally: DecodeFrame = async (source) => {
  decoder ??= import('../barcode/barcodeDecoder').then((module) => module.createBarcodeDecoder())
  return (await decoder)(source)
}

export function BarcodeScanner({
  onBack, onUseDrink, onAddManually, lookup = lookupBarcode, decode = decodeLocally,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const activeOperation = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const used = useRef(false)
  const [view, setView] = useState<View>({ kind: 'scanner' })
  const [camera, setCamera] = useState<'requesting' | 'active' | 'unavailable'>('requesting')
  const [guidance, setGuidance] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const beginOperation = useCallback(() => {
    activeOperation.current?.abort()
    const owner = new AbortController()
    activeOperation.current = owner
    return owner
  }, [])

  // Capture stops before lookup; a new owner survives the camera effect cleanup.
  // Back, replacement photo and unmount cancel it so late replies are discarded.
  const resolveBarcode = useCallback(async (code: DecodedBarcode) => {
    const owner = beginOperation()
    setView({ kind: 'lookup', barcode: code.value })
    try {
      const result = validateLookupResult(await lookup(code.value, owner.signal), code.value)
      if (owner.signal.aborted) return
      if (result.kind === 'match') setView(result)
      else if (result.kind === 'unavailable') setView({ kind: 'unavailable', barcode: code.value })
      else setView({ kind: 'not-found' })
    } catch {
      if (!owner.signal.aborted) setView({ kind: 'error', area: 'lookup' })
    }
  }, [beginOperation, lookup])

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => {
      activeOperation.current?.abort()
      element?.close()
    }
  }, [])

  useEffect(() => { heading.current?.focus() }, [view.kind])

  useEffect(() => {
    if (view.kind !== 'scanner' || !video.current) return
    const owner = beginOperation()
    void captureCamera({
      video: video.current, signal: owner.signal, decode,
      onReady: () => setCamera('active'),
      onGuidance: () => setGuidance(true),
      onDecoded: (code) => { void resolveBarcode(code) },
      onError: (area) => {
        if (area === 'camera') setCamera('unavailable')
        else setView({ kind: 'error', area: 'decoder' })
      },
    })
    return () => owner.abort()
  }, [view.kind, attempt, beginOperation, decode, resolveBarcode])

  function restart() {
    activeOperation.current?.abort()
    setCamera('requesting')
    setGuidance(false)
    setAttempt((value) => value + 1)
    setView({ kind: 'scanner' })
  }

  function back() {
    activeOperation.current?.abort()
    if (view.kind === 'scanner') onBack()
    else restart()
  }

  async function choosePhoto(file: File) {
    const owner = beginOperation()
    setView({ kind: 'photo-processing' })
    try {
      const code = await capturePhoto(file, owner.signal, decode)
      if (owner.signal.aborted) return
      if (code) await resolveBarcode(code)
      else setView({ kind: 'photo-unreadable' })
    } catch {
      if (!owner.signal.aborted) setView({ kind: 'error', area: 'decoder' })
    }
  }

  function addManually() {
    activeOperation.current?.abort()
    onAddManually()
  }

  const live = view.kind === 'scanner'
  return (
    <dialog ref={dialog} className={`barcode-dialog${live ? ' barcode-dialog--camera' : ''}`}
      aria-label="Scan Barcode" onCancel={(event) => {
        // File-picker cancellation bubbles; only the dialog's own cancel means Back.
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        back()
      }}>
      <div className="barcode-shell">
        <header className="barcode-topbar">
          <button className="barcode-back" type="button" onClick={back}
            aria-label={live ? 'Back to Record' : 'Back to Barcode Scanner'}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Back</span>
          </button>
          <h2 ref={heading} tabIndex={-1}>Scan Barcode</h2>
        </header>
        <input ref={fileInput} className="barcode-file-input" type="file" accept="image/*"
          aria-label="Choose a barcode photo" onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) void choosePhoto(file)
          }} />
        {live ? (
          <>
            <div className="barcode-camera-stage">
              <video ref={video} autoPlay muted playsInline aria-label="Live camera preview"
                className={camera === 'active' ? 'barcode-video' : 'barcode-video barcode-video--inactive'} />
              {camera === 'active' ? (
                <>
                  <div className="barcode-scan-frame" aria-hidden="true" />
                  <p className="barcode-position-guide">Position the barcode fully inside the scanning area.</p>
                  {guidance && <div className="barcode-guidance" role="status">
                    <strong>Having trouble scanning?</strong>
                    <p>Keep the barcode clear, fully visible and well lit. Scanning continues automatically.</p>
                  </div>}
                </>
              ) : (
                <div className="barcode-camera-message" role="status">
                  <h3>{camera === 'requesting' ? 'Preparing camera…' : 'Camera access wasn’t granted'}</h3>
                  <p>{camera === 'requesting'
                    ? 'Allow camera access if your browser asks. You can also choose a photo.'
                    : 'Live barcode scanning needs camera access. You can choose a photo below.'}</p>
                </div>
              )}
            </div>
            <footer className="barcode-camera-footer">
              <button type="button" className="barcode-photo-button" onClick={() => fileInput.current?.click()}>Choose Photo</button>
              <p>Camera images and photos stay on this device.</p>
            </footer>
          </>
        ) : (
          <section className="barcode-result" aria-live="polite">
            {view.kind === 'photo-processing' && <>
              <div className="barcode-spinner" aria-hidden="true" />
              <h3>Reading barcode…</h3><p>Looking for a readable barcode in your photo.</p>
            </>}
            {view.kind === 'lookup' && <>
              <div className="barcode-spinner" aria-hidden="true" />
              <h3>Looking up drink…</h3><p>Barcode: <span className="barcode-value">{view.barcode}</span></p>
            </>}
            {view.kind === 'match' && <>
              <span className="barcode-result-symbol" aria-hidden="true">✓</span>
              <h3>{view.product.drinkName}</h3>
              <p>{getDrinkTypeLabel(view.product.drinkType)} · {view.product.abvPercent}% ABV · {view.product.volumeMl} mL</p>
              <p className="barcode-provenance">Source: {view.product.sourceName}</p>
              <p>Check this is your drink. You can review and edit the details before saving a record.</p>
              <div className="barcode-actions">
                <button type="button" className="barcode-primary" onClick={() => {
                  if (used.current) return
                  used.current = true
                  activeOperation.current?.abort()
                  onUseDrink(view.product)
                }}>Use This Drink</button>
                <button type="button" className="barcode-secondary" onClick={restart}>Scan Again</button>
              </div>
            </>}
            {view.kind === 'photo-unreadable' && <>
              <span className="barcode-result-symbol" aria-hidden="true">!</span>
              <h3>We couldn’t read the barcode</h3>
              <p>Keep the barcode clear, fully visible and well lit. Choose an image no larger than 20 MB.</p>
              <button type="button" className="barcode-primary" onClick={() => fileInput.current?.click()}>Choose Another Photo</button>
            </>}
            {view.kind === 'not-found' && <>
              <span className="barcode-result-symbol" aria-hidden="true">!</span>
              <h3>Drink not found</h3><p>We couldn’t find a matching drink in our database.</p>
              <div className="barcode-actions">
                <button type="button" className="barcode-primary" onClick={addManually}>Add Drink Manually</button>
                <button type="button" className="barcode-secondary" onClick={restart}>Scan Another Barcode</button>
              </div>
            </>}
            {(view.kind === 'unavailable' || view.kind === 'error') && <>
              <span className="barcode-result-symbol" aria-hidden="true">!</span>
              <h3>{view.kind === 'unavailable' ? 'Barcode read' : view.area === 'lookup'
                ? 'We couldn’t look up this drink' : 'Barcode scanning is unavailable'}</h3>
              {view.kind === 'unavailable' && <p className="barcode-value">{view.barcode}</p>}
              <p>{view.kind === 'unavailable'
                ? 'Drink lookup is not available yet. You can add this drink manually.'
                : 'Please try again or add this drink manually. No matching result has been confirmed.'}</p>
              <div className="barcode-actions">
                <button type="button" className="barcode-primary" onClick={addManually}>Add Drink Manually</button>
                <button type="button" className="barcode-secondary" onClick={restart}>Scan Another Barcode</button>
              </div>
            </>}
          </section>
        )}
      </div>
    </dialog>
  )
}
