import { useState } from 'react'
import { DailyCheckIn } from './DailyCheckIn'
import { ReferenceDialog } from './ReferenceDialog'
import { displayCheckInDate, isCalendarDate } from '../types/dailyCheckIn'

/** Explicit past-date entry; selecting a date alone never saves a check-in. */
export function HistoricalCheckIn({ today, drinkingDates, alcoholFreeDates, onNoAlcohol, onAddDrink }: {
  today: string
  drinkingDates: readonly string[]
  alcoholFreeDates: readonly string[]
  onNoAlcohol: (date: string) => Promise<void>
  onAddDrink: (date: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const previous = new Date(today + 'T12:00:00')
  previous.setDate(previous.getDate() - 1)
  const latest = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}`
  const valid = (value: string) => isCalendarDate(value) && value < today
  const close = () => { if (!saving) setOpen(false) }
  const addDrink = (value: string) => {
    if (!valid(value)) { setError('Choose a valid date before today.'); return }
    onAddDrink(value)
    setOpen(false)
  }
  const saveNoAlcohol = async (value: string) => {
    if (!valid(value)) throw new Error('Choose a valid date before today.')
    setSaving(true)
    try { await onNoAlcohol(value); setOpen(false) } finally { setSaving(false) }
  }

  return <>
    <button type="button" className="history-check-in-action history-past-entry" onClick={() => {
      setDate(''); setSelected(null); setError(''); setOpen(true)
    }}>Add a past check-in</button>
    {open && <ReferenceDialog title="Add a past check-in" onClose={close}>
      <p>Choose the day you want to record, even if it was before you started using SipAware.</p>
      <form className="history-past-form" noValidate onSubmit={event => {
        event.preventDefault()
        if (!valid(date)) { setError('Choose a valid date before today.'); setSelected(null); return }
        setError(''); setSelected(date)
      }}>
        <label htmlFor="past-check-in-date">Check-in date</label>
        <input id="past-check-in-date" type="date" max={latest} value={date} required disabled={saving}
          aria-invalid={Boolean(error)} aria-describedby={error ? 'past-check-in-error' : undefined}
          onChange={event => { setDate(event.target.value); setSelected(null); setError('') }} />
        {error && <p id="past-check-in-error" role="alert">{error}</p>}
        <button className="ht-primary-button" type="submit" disabled={saving}>Continue</button>
      </form>
      {selected && <section className="history-past-options" aria-label="Past check-in options">
        <h3>{displayCheckInDate(selected)}</h3>
        {drinkingDates.includes(selected) ? <>
          <p>This date already has drinking records. You can add another drink or review the records in History.</p>
          <button type="button" className="ht-primary-button" onClick={() => addDrink(selected)}>Add drink</button>
        </> : alcoholFreeDates.includes(selected) ? <>
          <p>This date is already recorded as alcohol-free. No duplicate check-in is needed.</p>
          <button type="button" className="ht-primary-button" onClick={() => addDrink(selected)}>Add drink</button>
        </> : <DailyCheckIn compact date={selected} onNoAlcohol={saveNoAlcohol} onDrink={addDrink} />}
      </section>}
      <button type="button" className="history-backfill-cancel" disabled={saving} onClick={close}>Cancel</button>
    </ReferenceDialog>}
  </>
}
