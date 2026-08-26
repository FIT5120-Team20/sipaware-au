import {
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
} from 'react'

import { DRINK_TYPE_CONFIG, getDrinkTypeConfig } from '../config/drinkTypes'
import {
  createDrinkingRecord,
  type DrinkingRecord,
  type DrinkType,
} from '../types/drinkingRecord'
import {
  CUSTOM_SERVING_SIZE,
  type ManualDrinkField,
  type ManualDrinkFormErrors,
  type ManualDrinkFormValues,
} from '../types/manualDrinkForm'
import { validateManualDrinkInput } from '../validation/drinkingRecordValidation'

interface ManualDrinkFormProps {
  onSave: (record: DrinkingRecord) => void
}

interface FieldErrorProps {
  id: string
  message?: string
}

interface FieldDescriptionProps {
  children: ReactNode
  id: string
}

type SaveStatus =
  | {
      kind: 'success' | 'error'
      message: string
    }
  | null

const FIELD_FOCUS_ORDER: readonly ManualDrinkField[] = [
  'drinkType',
  'drinkName',
  'servingSizeSelection',
  'customVolumeMl',
  'abvPercent',
  'amountConsumed',
  'date',
  'time',
]

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

function createInitialManualDrinkFormValues(
  now = new Date(),
): ManualDrinkFormValues {
  return {
    drinkType: '',
    drinkName: '',
    servingSizeSelection: '',
    customVolumeMl: '',
    abvPercent: '',
    amountConsumed: '',
    date: `${now.getFullYear()}-${padDatePart(now.getMonth() + 1)}-${padDatePart(now.getDate())}`,
    time: `${padDatePart(now.getHours())}:${padDatePart(now.getMinutes())}`,
  }
}

function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null
  }

  return (
    <p className="field-error" id={id}>
      <strong>Error:</strong> {message}
    </p>
  )
}

function FieldDescription({ children, id }: FieldDescriptionProps) {
  return (
    <p className="field-help" id={id}>
      {children}
    </p>
  )
}

function describedBy(helpId: string, errorId: string, hasError: boolean) {
  return hasError ? `${helpId} ${errorId}` : helpId
}

export function ManualDrinkForm({ onSave }: ManualDrinkFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState(createInitialManualDrinkFormValues)
  const [errors, setErrors] = useState<ManualDrinkFormErrors>({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)
  const selectedDrinkType = getDrinkTypeConfig(values.drinkType)
  const isCustomVolume =
    values.servingSizeSelection === CUSTOM_SERVING_SIZE

  function clearErrors(...fields: ManualDrinkField[]) {
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }
      for (const field of fields) {
        delete nextErrors[field]
      }
      return nextErrors
    })
  }

  function updateValue<Field extends ManualDrinkField>(
    field: Field,
    value: ManualDrinkFormValues[Field],
  ) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    clearErrors(field)
    setSaveStatus(null)
  }

  function handleDrinkTypeChange(value: DrinkType | '') {
    const drinkTypeConfig = getDrinkTypeConfig(value)
    const servingSizeSelection =
      drinkTypeConfig && drinkTypeConfig.servingSizesMl.length === 0
        ? CUSTOM_SERVING_SIZE
        : ''

    setValues((currentValues) => ({
      ...currentValues,
      drinkType: value,
      servingSizeSelection,
      customVolumeMl: '',
    }))
    clearErrors('drinkType', 'servingSizeSelection', 'customVolumeMl')
    setSaveStatus(null)
  }

  function handleServingSizeChange(value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      servingSizeSelection: value,
      customVolumeMl:
        value === CUSTOM_SERVING_SIZE ? currentValues.customVolumeMl : '',
    }))
    clearErrors('servingSizeSelection', 'customVolumeMl')
    setSaveStatus(null)
  }

  function focusFirstInvalidField(validationErrors: ManualDrinkFormErrors) {
    const firstInvalidField = FIELD_FOCUS_ORDER.find(
      (field) => validationErrors[field],
    )

    if (!firstInvalidField) {
      return
    }

    queueMicrotask(() => {
      const formControl =
        formRef.current?.elements.namedItem(firstInvalidField)
      if (formControl instanceof HTMLElement) {
        formControl.focus()
      }
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveStatus(null)

    const validationResult = validateManualDrinkInput(values)
    if (!validationResult.success) {
      setErrors(validationResult.errors)
      setSaveStatus({
        kind: 'error',
        message: 'Check the highlighted fields before saving this record.',
      })
      focusFirstInvalidField(validationResult.errors)
      return
    }

    try {
      onSave(createDrinkingRecord(validationResult.data))
    } catch {
      setSaveStatus({
        kind: 'error',
        message:
          'This record could not be saved on this device. Your entries have been kept so you can try again.',
      })
      return
    }

    setErrors({})
    setValues(createInitialManualDrinkFormValues())
    setSaveStatus({
      kind: 'success',
      message: 'Drinking record saved on this device.',
    })
  }

  return (
    <section className="manual-drink-card" aria-labelledby="manual-drink-title">
      <div className="section-heading">
        <p className="section-kicker">Manual drink capture</p>
        <h2 id="manual-drink-title">What did you drink?</h2>
        <p>
          Enter the drink and the serving amount you consumed. All fields are
          required.
        </p>
      </div>

      {saveStatus && (
        <div
          className={`form-notice form-notice--${saveStatus.kind}`}
          role={saveStatus.kind === 'error' ? 'alert' : 'status'}
          aria-live={saveStatus.kind === 'error' ? 'assertive' : 'polite'}
        >
          {saveStatus.message}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="drink-type">Drink type</label>
          <select
            id="drink-type"
            name="drinkType"
            value={values.drinkType}
            onChange={(event) =>
              handleDrinkTypeChange(event.target.value as DrinkType | '')
            }
            aria-invalid={Boolean(errors.drinkType)}
            aria-describedby={errors.drinkType ? 'drink-type-error' : undefined}
            required
          >
            <option value="">Select a drink type</option>
            {DRINK_TYPE_CONFIG.map((drinkType) => (
              <option key={drinkType.value} value={drinkType.value}>
                {drinkType.label}
              </option>
            ))}
          </select>
          <FieldError id="drink-type-error" message={errors.drinkType} />
        </div>

        <div className="form-field">
          <label htmlFor="drink-name">Drink name</label>
          <input
            id="drink-name"
            name="drinkName"
            type="text"
            value={values.drinkName}
            onChange={(event) => updateValue('drinkName', event.target.value)}
            aria-invalid={Boolean(errors.drinkName)}
            aria-describedby={errors.drinkName ? 'drink-name-error' : undefined}
            autoComplete="off"
            required
          />
          <FieldError id="drink-name-error" message={errors.drinkName} />
        </div>

        <div className="form-field">
          <label htmlFor="serving-size">Serving size / volume</label>
          <select
            id="serving-size"
            name="servingSizeSelection"
            value={values.servingSizeSelection}
            onChange={(event) => handleServingSizeChange(event.target.value)}
            aria-invalid={Boolean(errors.servingSizeSelection)}
            aria-describedby={describedBy(
              'serving-size-help',
              'serving-size-error',
              Boolean(errors.servingSizeSelection),
            )}
            disabled={!selectedDrinkType}
            required
          >
            <option value="">Select a serving size</option>
            {selectedDrinkType?.servingSizesMl.map((volumeMl) => (
              <option key={volumeMl} value={String(volumeMl)}>
                {volumeMl} mL
              </option>
            ))}
            {selectedDrinkType && (
              <option value={CUSTOM_SERVING_SIZE}>Custom volume</option>
            )}
          </select>
          <FieldDescription id="serving-size-help">
            Choose a common serving size or enter a custom volume.
          </FieldDescription>
          <FieldError
            id="serving-size-error"
            message={errors.servingSizeSelection}
          />
        </div>

        {isCustomVolume && (
          <div className="form-field">
            <label htmlFor="custom-volume">Custom volume (mL)</label>
            <input
              id="custom-volume"
              name="customVolumeMl"
              type="number"
              inputMode="decimal"
              step="any"
              value={values.customVolumeMl}
              onChange={(event) =>
                updateValue('customVolumeMl', event.target.value)
              }
              aria-invalid={Boolean(errors.customVolumeMl)}
              aria-describedby={
                errors.customVolumeMl ? 'custom-volume-error' : undefined
              }
              required
            />
            <FieldError
              id="custom-volume-error"
              message={errors.customVolumeMl}
            />
          </div>
        )}

        <div className="form-field">
          <label htmlFor="abv-percent">ABV (%)</label>
          <input
            id="abv-percent"
            name="abvPercent"
            type="number"
            inputMode="decimal"
            step="any"
            max="100"
            value={values.abvPercent}
            onChange={(event) => updateValue('abvPercent', event.target.value)}
            aria-invalid={Boolean(errors.abvPercent)}
            aria-describedby={describedBy(
              'abv-help',
              'abv-error',
              Boolean(errors.abvPercent),
            )}
            required
          />
          <FieldDescription id="abv-help">
            Enter the alcohol percentage shown on the drink label.
          </FieldDescription>
          <FieldError id="abv-error" message={errors.abvPercent} />
        </div>

        <div className="form-field">
          <label htmlFor="amount-consumed">Number of servings consumed</label>
          <input
            id="amount-consumed"
            name="amountConsumed"
            type="number"
            inputMode="decimal"
            step="any"
            value={values.amountConsumed}
            onChange={(event) =>
              updateValue('amountConsumed', event.target.value)
            }
            aria-invalid={Boolean(errors.amountConsumed)}
            aria-describedby={describedBy(
              'amount-consumed-help',
              'amount-consumed-error',
              Boolean(errors.amountConsumed),
            )}
            required
          />
          <FieldDescription id="amount-consumed-help">
            Enter the number of servings consumed, for example 1.5.
          </FieldDescription>
          <FieldError
            id="amount-consumed-error"
            message={errors.amountConsumed}
          />
        </div>

        <fieldset className="date-time-fields">
          <legend>When did you drink this?</legend>

          <div className="date-time-grid">
            <div className="form-field">
              <label htmlFor="consumed-date">Date</label>
              <input
                id="consumed-date"
                name="date"
                type="date"
                value={values.date}
                onChange={(event) => updateValue('date', event.target.value)}
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? 'consumed-date-error' : undefined}
                required
              />
              <FieldError id="consumed-date-error" message={errors.date} />
            </div>

            <div className="form-field">
              <label htmlFor="consumed-time">Time</label>
              <input
                id="consumed-time"
                name="time"
                type="time"
                step="60"
                value={values.time}
                onChange={(event) => updateValue('time', event.target.value)}
                aria-invalid={Boolean(errors.time)}
                aria-describedby={errors.time ? 'consumed-time-error' : undefined}
                required
              />
              <FieldError id="consumed-time-error" message={errors.time} />
            </div>
          </div>
        </fieldset>

        <button className="primary-button" type="submit">
          Save drinking record
        </button>
      </form>
    </section>
  )
}
