import { type FormEvent, useId, useRef, useState } from 'react'

import { DRINK_TYPE_CONFIG, getDrinkTypeConfig } from '../config/drinkTypes'
import type { DrinkType } from '../types/drinkingRecord'
import {
  CUSTOM_SERVING_SIZE,
  type ReusableDrinkField,
  type ReusableDrinkFormErrors,
  type ReusableDrinkFormValues,
} from '../types/manualDrinkForm'
import {
  createUpdatedSavedDrink,
  type SavedDrink,
} from '../types/savedDrink'
import { validateReusableDrinkInput } from '../validation/drinkingRecordValidation'

interface SavedDrinkEditorProps {
  savedDrink: SavedDrink
  onSave: (savedDrink: SavedDrink) => void
  onCancel: () => void
}

const EDIT_FIELD_FOCUS_ORDER: readonly ReusableDrinkField[] = [
  'drinkType',
  'drinkName',
  'servingSizeSelection',
  'customVolumeMl',
  'abvPercent',
]

function createEditorValues(savedDrink: SavedDrink): ReusableDrinkFormValues {
  const drinkTypeConfig = getDrinkTypeConfig(savedDrink.drinkType)
  const usesCommonServingSize = Boolean(
    drinkTypeConfig?.servingSizesMl.includes(savedDrink.servingVolumeMl),
  )

  return {
    drinkType: savedDrink.drinkType,
    drinkName: savedDrink.drinkName,
    servingSizeSelection: usesCommonServingSize
      ? String(savedDrink.servingVolumeMl)
      : CUSTOM_SERVING_SIZE,
    customVolumeMl: usesCommonServingSize
      ? ''
      : String(savedDrink.servingVolumeMl),
    abvPercent: String(savedDrink.abvPercent),
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null
  }

  return (
    <p className="field-error" id={id}>
      <strong>Error:</strong> {message}
    </p>
  )
}

export function SavedDrinkEditor({
  savedDrink,
  onSave,
  onCancel,
}: SavedDrinkEditorProps) {
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState<ReusableDrinkFormValues>(() =>
    createEditorValues(savedDrink),
  )
  const [errors, setErrors] = useState<ReusableDrinkFormErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const selectedDrinkType = getDrinkTypeConfig(values.drinkType)
  const isCustomVolume =
    values.servingSizeSelection === CUSTOM_SERVING_SIZE

  function clearErrors(...fields: ReusableDrinkField[]) {
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }
      for (const field of fields) {
        delete nextErrors[field]
      }
      return nextErrors
    })
  }

  function updateValue<Field extends ReusableDrinkField>(
    field: Field,
    value: ReusableDrinkFormValues[Field],
  ) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    clearErrors(field)
    setSaveError(null)
  }

  function handleDrinkTypeChange(drinkType: DrinkType | '') {
    const drinkTypeConfig = getDrinkTypeConfig(drinkType)
    const servingSizeSelection =
      drinkTypeConfig && drinkTypeConfig.servingSizesMl.length === 0
        ? CUSTOM_SERVING_SIZE
        : ''

    setValues((currentValues) => ({
      ...currentValues,
      drinkType,
      servingSizeSelection,
      customVolumeMl: '',
    }))
    clearErrors('drinkType', 'servingSizeSelection', 'customVolumeMl')
    setSaveError(null)
  }

  function handleServingSizeChange(servingSizeSelection: string) {
    setValues((currentValues) => ({
      ...currentValues,
      servingSizeSelection,
      customVolumeMl:
        servingSizeSelection === CUSTOM_SERVING_SIZE
          ? currentValues.customVolumeMl
          : '',
    }))
    clearErrors('servingSizeSelection', 'customVolumeMl')
    setSaveError(null)
  }

  function focusFirstInvalidField(validationErrors: ReusableDrinkFormErrors) {
    const firstInvalidField = EDIT_FIELD_FOCUS_ORDER.find(
      (field) => validationErrors[field],
    )

    if (!firstInvalidField) {
      return
    }

    queueMicrotask(() => {
      const formControl = formRef.current?.elements.namedItem(firstInvalidField)
      if (formControl instanceof HTMLElement) {
        formControl.focus()
      }
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError(null)

    const validationResult = validateReusableDrinkInput(values)
    if (!validationResult.success) {
      setErrors(validationResult.errors)
      setSaveError('Check the highlighted details before saving changes.')
      focusFirstInvalidField(validationResult.errors)
      return
    }

    try {
      onSave(createUpdatedSavedDrink(savedDrink, validationResult.data))
    } catch {
      setSaveError(
        'Changes could not be saved on this device. Your entries have been kept so you can try again.',
      )
    }
  }

  const fieldId = (field: string) => `${formId}-${field}`

  return (
    <form
      className="saved-drink-editor"
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={fieldId('title')}
    >
      <h4 id={fieldId('title')}>Edit {savedDrink.drinkName}</h4>

      {saveError && (
        <div className="management-notice management-notice--error" role="alert">
          {saveError}
        </div>
      )}

      <div className="form-field">
        <label htmlFor={fieldId('drink-type')}>Edit drink type</label>
        <select
          id={fieldId('drink-type')}
          name="drinkType"
          value={values.drinkType}
          onChange={(event) =>
            handleDrinkTypeChange(event.target.value as DrinkType | '')
          }
          aria-invalid={Boolean(errors.drinkType)}
          aria-describedby={
            errors.drinkType ? fieldId('drink-type-error') : undefined
          }
          required
        >
          <option value="">Select a drink type</option>
          {DRINK_TYPE_CONFIG.map((drinkType) => (
            <option key={drinkType.value} value={drinkType.value}>
              {drinkType.label}
            </option>
          ))}
        </select>
        <FieldError
          id={fieldId('drink-type-error')}
          message={errors.drinkType}
        />
      </div>

      <div className="form-field">
        <label htmlFor={fieldId('drink-name')}>Edit drink name</label>
        <input
          id={fieldId('drink-name')}
          name="drinkName"
          type="text"
          value={values.drinkName}
          onChange={(event) => updateValue('drinkName', event.target.value)}
          aria-invalid={Boolean(errors.drinkName)}
          aria-describedby={
            errors.drinkName ? fieldId('drink-name-error') : undefined
          }
          autoComplete="off"
          required
        />
        <FieldError
          id={fieldId('drink-name-error')}
          message={errors.drinkName}
        />
      </div>

      <div className="form-field">
        <label htmlFor={fieldId('serving-size')}>
          Edit serving size / volume
        </label>
        <select
          id={fieldId('serving-size')}
          name="servingSizeSelection"
          value={values.servingSizeSelection}
          onChange={(event) => handleServingSizeChange(event.target.value)}
          aria-invalid={Boolean(errors.servingSizeSelection)}
          aria-describedby={
            errors.servingSizeSelection
              ? fieldId('serving-size-error')
              : undefined
          }
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
        <FieldError
          id={fieldId('serving-size-error')}
          message={errors.servingSizeSelection}
        />
      </div>

      {isCustomVolume && (
        <div className="form-field">
          <label htmlFor={fieldId('custom-volume')}>
            Edit custom volume (mL)
          </label>
          <input
            id={fieldId('custom-volume')}
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
              errors.customVolumeMl
                ? fieldId('custom-volume-error')
                : undefined
            }
            required
          />
          <FieldError
            id={fieldId('custom-volume-error')}
            message={errors.customVolumeMl}
          />
        </div>
      )}

      <div className="form-field">
        <label htmlFor={fieldId('abv-percent')}>Edit ABV (%)</label>
        <input
          id={fieldId('abv-percent')}
          name="abvPercent"
          type="number"
          inputMode="decimal"
          step="any"
          max="100"
          value={values.abvPercent}
          onChange={(event) => updateValue('abvPercent', event.target.value)}
          aria-invalid={Boolean(errors.abvPercent)}
          aria-describedby={
            errors.abvPercent ? fieldId('abv-error') : undefined
          }
          required
        />
        <FieldError id={fieldId('abv-error')} message={errors.abvPercent} />
      </div>

      <div className="management-actions">
        <button className="primary-button" type="submit">
          Save changes
        </button>
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancel editing
        </button>
      </div>
    </form>
  )
}
