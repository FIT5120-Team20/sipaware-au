import { useConsumptionTimeLimit } from '../hooks/useConsumptionTimeLimit'
import type { ConsumptionDateTimeErrors, ConsumptionDateTimeValues } from '../types/manualDrinkForm'

type Props = {
  idPrefix: string
  values: ConsumptionDateTimeValues
  errors?: ConsumptionDateTimeErrors
  onChange: (field: keyof ConsumptionDateTimeValues, value: string) => void
  legend?: string
  className?: string
  disabled?: boolean
}

/** Shared native controls extracted from the drinking-record editor. */
export function ConsumptionDateTimeFields({
  idPrefix, values, errors = {}, onChange,
  legend = 'When was this drink consumed?', className = '', disabled = false,
}: Props) {
  const timeLimit = useConsumptionTimeLimit()
  const fieldId = (field: string) => `${idPrefix}-${field}`

  return (
    <fieldset className={`date-time-fields ${className}`.trim()} disabled={disabled}>
      <legend>{legend}</legend>
      <div className="date-time-grid">
        <div className="form-field">
          <label htmlFor={fieldId('date')}>Date</label>
          <input
            id={fieldId('date')}
            name="date"
            type="date"
            max={timeLimit.date}
            onFocus={timeLimit.refresh}
            value={values.date}
            onChange={(event) => onChange('date', event.target.value)}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? fieldId('date-error') : undefined}
            required
          />
          {errors.date && <p className="field-error" id={fieldId('date-error')}><strong>Error:</strong> {errors.date}</p>}
        </div>
        <div className="form-field">
          <label htmlFor={fieldId('time')}>Time</label>
          <input
            id={fieldId('time')}
            name="time"
            type="time"
            max={values.date === timeLimit.date ? timeLimit.time : undefined}
            onFocus={timeLimit.refresh}
            step="60"
            value={values.time}
            onChange={(event) => onChange('time', event.target.value)}
            aria-invalid={Boolean(errors.time)}
            aria-describedby={errors.time ? fieldId('time-error') : undefined}
            required
          />
          {errors.time && <p className="field-error" id={fieldId('time-error')}><strong>Error:</strong> {errors.time}</p>}
        </div>
      </div>
    </fieldset>
  )
}
