import { useEffect, useId, useRef, useState } from 'react'
import { getDrinkTypeLabel } from '../config/drinkTypes'
import { scanDrinkLabel, type LabelOcrResult } from '../ocr/labelOcr'
import '../labelScanner.css'

export function LabelScanner({ onResult, disabled }: {
  onResult: (result: LabelOcrResult) => void
  disabled: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const owner = useRef<AbortController | null>(null)
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LabelOcrResult | null>(null)
  const [photo, setPhoto] = useState<{ name: string; url: string } | null>(null)
  useEffect(() => () => owner.current?.abort(), [])
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])

  async function scan(file: File) {
    owner.current?.abort()
    const request = new AbortController()
    owner.current = request
    setError('')
    setResult(null)
    setPhoto(null)
    setBusy(true)
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && file.size <= 4 * 1024 * 1024) {
      setPhoto({ name: file.name, url: URL.createObjectURL(file) })
    }
    try {
      const response = await scanDrinkLabel(file, request.signal)
      if (request.signal.aborted) return
      setResult(response)
      onResult(response)
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Scanning failed. Try another photo.')
    } finally {
      if (owner.current === request) setBusy(false)
    }
  }

  return <section className="prototype-scan-card label-scanner" aria-labelledby={id}>
    <div className="prototype-scan-card-title"><h2 id={id}>Scan drink label</h2></div>
    <p>Upload a clear label photo to help fill in the drink details. Your existing entries are kept.</p>
    <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp"
      aria-label="Choose a drink label photo" disabled={disabled || busy}
      onChange={event => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void scan(file)
      }} />
    <div className="label-scanner-actions">
      <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {photo ? 'Scan Another Label' : 'Scan Label'}
      </button>
      {busy && <button type="button" onClick={() => {
        owner.current?.abort()
        setBusy(false)
        setError('Scan cancelled. Your entries have been kept.')
      }}>Cancel scan</button>}
    </div>
    {photo && <img className="label-scanner-photo" src={photo.url} alt={`Selected label: ${photo.name}`} />}
    {busy && <p role="status">Reading the label… The first scan may take longer while the model loads.</p>}
    {error && <p role="alert" className="field-error">{error}</p>}
    {result && <div className="label-scanner-result">
      <p role="status">{result.lines.length
        ? 'Scan complete. Review the suggestions and the prefilled fields below. Nothing has been saved.'
        : 'No readable text found. Try another photo or enter the drink details manually.'}</p>
      <dl>
        <div><dt>Suggested name</dt><dd>{result.fields.drinkName ?? 'Not found'}</dd></div>
        <div><dt>Suggested type</dt><dd>{result.fields.drinkType ? getDrinkTypeLabel(result.fields.drinkType) : 'Select manually'}</dd></div>
        <div><dt>Container volume</dt><dd>{result.fields.containerVolumeMl === null ? 'Not found' : `${result.fields.containerVolumeMl} mL`}</dd></div>
        <div><dt>ABV</dt><dd>{result.fields.abvPercent === null ? 'Not found' : `${result.fields.abvPercent}%`}</dd></div>
      </dl>
      {result.warnings.map((warning, index) => <p className="field-help" key={index}>{warning}</p>)}
      {result.lines.length > 0 && <details><summary>Recognized label text</summary>
        <ul>{result.lines.map((line, index) => <li key={index}>{line.text}</li>)}</ul>
      </details>}
    </div>}
  </section>
}
