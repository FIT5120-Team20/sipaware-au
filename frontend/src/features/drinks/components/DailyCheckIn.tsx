/** Approved check-in presentation shared by Record and inline History backfill.
 * These controls request actions; only the page/repository can persist a day.
 * Decorative logos never replace the readable, keyboard-accessible choices. */
import { useRef, useState } from 'react'
import { IcoCalendar } from './ReferenceRecordBrowser'
import { displayCheckInDate } from '../types/dailyCheckIn'
import '../dailyCheckIn.css'

export function CheckInLogo({ kind }: { kind: 'zero' | 'drink' }) {
  return <svg className="check-in-logo" viewBox="0 0 220 200" aria-hidden="true" focusable="false">
    {kind === 'zero' ? <>
      <circle cx="106" cy="97" r="84" fill="#dceee8" />
      <ellipse cx="106" cy="170" rx="57" ry="7" fill="#28605c" opacity=".09" />
      <path d="M69 77c0-23 15-39 35-39s35 16 35 39v38c0 23-15 39-35 39s-35-16-35-39V77Z" fill="#fff" stroke="#28605c" strokeWidth="5" />
      <path d="M90 77c0-13 5-20 14-20s14 7 14 20v38c0 13-5 20-14 20s-14-7-14-20V77Z" fill="#eaf4f0" />
      <path d="M127 76c-3-27 16-42 48-43 0 26-16 45-42 43Z" fill="#8fc0ad" stroke="#28605c" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="m120 92 36-41" fill="none" stroke="#28605c" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="154" cy="140" r="24" fill="#fff" stroke="#28605c" strokeWidth="3" />
      <path d="m144 140 7 7 13-15" fill="none" stroke="#28605c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="37" cy="100" r="4" fill="#8fc0ad" /><path d="M50 46v12m-6-6h12" stroke="#6da38e" strokeWidth="2.5" strokeLinecap="round" />
    </> : <>
      <circle cx="112" cy="97" r="84" fill="#dde8fb" />
      <ellipse cx="112" cy="170" rx="57" ry="7" fill="#1a5fcc" opacity=".09" />
      <path d="M69 41h68l-5 48c-2 17-14 28-29 28S76 106 74 89l-5-48Z" fill="#fff" stroke="#1a5fcc" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M76 77c16-9 32 9 56 0l-1 11c-2 16-13 27-28 27S78 104 76 88V77Z" fill="#96b6ee" />
      <path d="M103 118v36m-21 2h42" stroke="#1a5fcc" strokeWidth="4.5" strokeLinecap="round" />
      <path d="m141 137 32-48a7 7 0 0 1 12 8l-32 48-17 11 5-19Z" fill="#fff" stroke="#1a5fcc" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="m169 95 12 8m-40 34 12 8m-17 11 5-19" fill="none" stroke="#1a5fcc" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M47 73h13m-13 10h9M153 39v12m-6-6h12" stroke="#7799d0" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="186" cy="129" r="4" fill="#96b6ee" />
    </>}
  </svg>
}

type Props = {
  date: string
  compact?: boolean
  hasDrinks?: boolean
  onNoAlcohol: (date: string) => Promise<void>
  onDrink: (date: string) => void
}

export function DailyCheckIn({ date, compact = false, hasDrinks = false, onNoAlcohol, onDrink }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  async function saveZero() {
    if (pending.current) return
    if (hasDrinks) { setError('This day already has drinking records. Review them in History before marking it alcohol-free.'); return }
    pending.current = true
    setBusy(true); setError(null)
    try { await onNoAlcohol(date) }
    catch { setError('This day could not be saved as alcohol-free. Check for existing drinking records in History, or try again. Nothing has been overwritten.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className={compact ? 'daily-check-in daily-check-in--compact' : 'daily-check-in'} aria-label={compact ? 'Add entry for ' + date : 'Record daily check-in'}>
    {!compact && <><h1 className="reference-sr-only">Record</h1><p className="check-in-date"><IcoCalendar /><span>Today · {displayCheckInDate(date)}</span></p></>}
    <div className="check-in-choices" aria-busy={busy}>
      <button type="button" className="check-in-choice check-in-choice--zero" disabled={busy} onClick={() => void saveZero()}>
        <span className="check-in-choice-content"><CheckInLogo kind="zero" />
          <span className="check-in-title">{compact ? 'No alcohol' : 'No alcohol today'}</span>
          {!compact && <span className="check-in-copy">Save this day as alcohol-free.<br />Your history will show 0 drinks.</span>}
          <span className="check-in-cta">{busy ? 'Saving…' : 'Save & view history'} <span aria-hidden="true">→</span></span>
        </span>
      </button>
      <button type="button" className="check-in-choice check-in-choice--drink" disabled={busy} onClick={() => onDrink(date)}>
        <span className="check-in-choice-content"><CheckInLogo kind="drink" />
          <span className="check-in-title">{compact ? 'I drank' : 'I drank today'}</span>
          {!compact && <span className="check-in-copy">Add what you drank<br />and how much you had.</span>}
          <span className="check-in-cta">Record a drink <span aria-hidden="true">→</span></span>
        </span>
      </button>
      {!compact && <svg className="check-in-divider" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="60" y1="0" x2="40" y2="100" /></svg>}
    </div>
    {error && <p className="check-in-error" role="alert">{error}</p>}
  </section>
}
