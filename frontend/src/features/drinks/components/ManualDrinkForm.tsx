/**
 * Collects raw HTML control strings for manual and quick drink recording.
 *
 * Raw form values are not trusted domain data. This component validates and
 * transforms them before creating a SavedDrink template or an independent
 * DrinkingRecord snapshot, then delegates persistence through parent callbacks.
 */
import {
  type FormEvent,
  type ReactNode,
  useRef,
  useState,
} from 'react'

import {
  getApplicableServingSizes,
  getDrinkReferenceCategory,
  includePersistedDrinkType,
} from '../config/drinkTypes'
import {
  createDrinkingRecord,
  type DrinkingRecord,
  type DrinkType,
} from '../types/drinkingRecord'
import { createSavedDrink, type SavedDrink } from '../types/savedDrink'
import {
  CUSTOM_SERVING_SIZE,
  type ManualDrinkField,
  type ManualDrinkFormErrors,
  type ManualDrinkFormValues,
  type ReusableDrinkField,
} from '../types/manualDrinkForm'
import type {
  DrinkReferenceCategory,
  ReferenceLoadStatus,
} from '../types/drinkReference'
import {
  validateManualDrinkInput,
  validateReusableDrinkInput,
} from '../validation/drinkingRecordValidation'
import { SavedDrinkPicker } from './SavedDrinkPicker'

interface ManualDrinkFormProps {
  referenceCategories: readonly DrinkReferenceCategory[]
  referenceStatus: ReferenceLoadStatus
  onRetryReferenceData: () => void
  savedDrinks: readonly SavedDrink[]
  onSave: (record: DrinkingRecord) => void | Promise<void>
  onSaveSavedDrink: (savedDrink: SavedDrink) => void | Promise<void>
  onUpdateSavedDrink: (savedDrink: SavedDrink) => void | Promise<void>
  onDeleteSavedDrink: (savedDrinkId: string) => void | Promise<void>
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
const REUSABLE_DRINK_FIELDS: readonly ReusableDrinkField[] = [
  'drinkType',
  'drinkName',
  'servingSizeSelection',
  'customVolumeMl',
  'abvPercent',
]

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

function createInitialManualDrinkFormValues(
  now = new Date(),
): ManualDrinkFormValues {
  // Date and time inputs start from the user's local wall clock, not UTC, so a
  // new record initially reflects the occasion the user sees on their device.
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

export function ManualDrinkForm({
  referenceCategories,
  referenceStatus,
  onRetryReferenceData,
  savedDrinks,
  onSave,
  onSaveSavedDrink,
  onUpdateSavedDrink,
  onDeleteSavedDrink,
}: ManualDrinkFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState(createInitialManualDrinkFormValues)
  const [errors, setErrors] = useState<ManualDrinkFormErrors>({})
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)
  const [isPersisting, setIsPersisting] = useState(false)
  const [selectedSavedDrinkId, setSelectedSavedDrinkId] = useState<
    string | null
  >(null)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    null,
  )
  const selectedSavedDrink = savedDrinks.find(
    (savedDrink) => savedDrink.id === selectedSavedDrinkId,
  )
  const availableCategories = includePersistedDrinkType(
    referenceCategories,
    selectedSavedDrink?.drinkType ?? values.drinkType,
  )
  const selectedCategory = getDrinkReferenceCategory(
    availableCategories,
    values.drinkType,
  )
  const applicableServingSizes = getApplicableServingSizes(
    selectedCategory,
    selectedVariantId,
  )
  // A selected SavedDrink supplies reusable attributes and therefore locks the
  // corresponding controls below. Occasion-specific servings, date, and time
  // remain editable because they belong to the new DrinkingRecord, not the template.
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
    const category = getDrinkReferenceCategory(referenceCategories, value)
    const categoryServingSizes = getApplicableServingSizes(category, null)
    const servingSizeSelection =
      category &&
      category.variants.length === 0 &&
      categoryServingSizes.length === 0
        ? CUSTOM_SERVING_SIZE
        : ''

    setSelectedVariantId(null)
    setValues((currentValues) => ({
      ...currentValues,
      drinkType: value,
      servingSizeSelection,
      customVolumeMl: '',
    }))
    clearErrors('drinkType', 'servingSizeSelection', 'customVolumeMl')
    setSaveStatus(null)
  }

  function handleVariantChange(value: string) {
    const variantId = value ? Number(value) : null
    const servingSizes = getApplicableServingSizes(
      selectedCategory,
      variantId,
    )

    setSelectedVariantId(variantId)
    setValues((currentValues) => ({
      ...currentValues,
      servingSizeSelection:
        selectedCategory && servingSizes.length === 0
          ? CUSTOM_SERVING_SIZE
          : '',
      customVolumeMl: '',
    }))
    clearErrors('servingSizeSelection', 'customVolumeMl')
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

  function handleSavedDrinkSelect(savedDrink: SavedDrink) {
    // Copy values from the reusable template into this occasion's form. The new
    // history record will contain its own values, not a live SavedDrink link.
    // Stored volume remains personal truth even if current Neon options differ,
    // so quick record represents it as Custom rather than reclassifying it.
    setSelectedVariantId(null)

    setValues((currentValues) => ({
      ...currentValues,
      drinkType: savedDrink.drinkType,
      drinkName: savedDrink.drinkName,
      servingSizeSelection: CUSTOM_SERVING_SIZE,
      customVolumeMl: String(savedDrink.servingVolumeMl),
      abvPercent: String(savedDrink.abvPercent),
    }))
    clearErrors(...REUSABLE_DRINK_FIELDS)
    setSelectedSavedDrinkId(savedDrink.id)
    setSaveStatus(null)
  }

  function clearSavedDrinkSelection() {
    // Returning to manual entry releases the template selection and its field
    // locks so reusable attributes can be entered independently again.
    setSelectedVariantId(null)
    setValues((currentValues) => ({
      ...currentValues,
      drinkType: '',
      drinkName: '',
      servingSizeSelection: '',
      customVolumeMl: '',
      abvPercent: '',
    }))
    clearErrors(...REUSABLE_DRINK_FIELDS)
    setSelectedSavedDrinkId(null)
    setSaveStatus(null)
  }

  async function handleSavedDrinkUpdate(savedDrink: SavedDrink) {
    await onUpdateSavedDrink(savedDrink)
    if (savedDrink.id === selectedSavedDrinkId) {
      handleSavedDrinkSelect(savedDrink)
    }
  }

  async function handleSavedDrinkDelete(savedDrinkId: string) {
    await onDeleteSavedDrink(savedDrinkId)
    if (savedDrinkId === selectedSavedDrinkId) {
      clearSavedDrinkSelection()
    }
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

  /**
   * Validate raw strings and create one self-contained historical snapshot.
   * Serving volume describes the size of one serving; amountConsumed records
   * how many servings were consumed. Saving never mutates a selected template.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    setIsPersisting(true)
    try {
      await onSave(createDrinkingRecord(validationResult.data))
    } catch {
      setIsPersisting(false)
      setSaveStatus({
        kind: 'error',
        message:
          'This record could not be saved on this device. Your entries have been kept so you can try again.',
      })
      return
    }

    setIsPersisting(false)
    setErrors({})
    setValues(createInitialManualDrinkFormValues())
    setSelectedSavedDrinkId(null)
    setSaveStatus({
      kind: 'success',
      message: 'Drinking record saved on this device.',
    })
  }

  /**
   * Save only reusable drink attributes as a SavedDrink template.
   * Occasion-specific servings, date, and time are intentionally excluded.
   */
  async function handleSaveForFutureUse() {
    setSaveStatus(null)

    const validationResult = validateReusableDrinkInput(values)
    if (!validationResult.success) {
      setErrors(validationResult.errors)
      setSaveStatus({
        kind: 'error',
        message:
          'Check the highlighted drink details before saving to My Drinks.',
      })
      focusFirstInvalidField(validationResult.errors)
      return
    }

    setIsPersisting(true)
    try {
      const savedDrink = createSavedDrink(validationResult.data)
      await onSaveSavedDrink(savedDrink)
      setSelectedSavedDrinkId(savedDrink.id)
    } catch {
      setIsPersisting(false)
      setSaveStatus({
        kind: 'error',
        message:
          'This drink could not be saved to My Drinks on this device. Your entries have been kept so you can try again.',
      })
      return
    }

    setIsPersisting(false)
    setErrors({})
    setSaveStatus({
      kind: 'success',
      message: 'Drink saved to My Drinks on this device.',
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

      {referenceStatus === 'loading' && (
        <div className="form-notice" role="status">
          Loading current drink reference options...
        </div>
      )}

      {referenceStatus === 'failed' && (
        <div className="form-notice form-notice--error" role="alert">
          <p>
            Drink reference options are temporarily unavailable. Drinks already
            in My Drinks and your drinking history are still stored on this
            device and have not been changed.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={onRetryReferenceData}
          >
            Retry drink options
          </button>
        </div>
      )}

      <SavedDrinkPicker
        referenceCategories={referenceCategories}
        savedDrinks={savedDrinks}
        selectedSavedDrinkId={selectedSavedDrinkId}
        onSelect={handleSavedDrinkSelect}
        onClear={clearSavedDrinkSelection}
        onUpdate={handleSavedDrinkUpdate}
        onDelete={handleSavedDrinkDelete}
      />

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
            disabled={
              Boolean(selectedSavedDrink) || availableCategories.length === 0
            }
            required
          >
            <option value="">Select a drink type</option>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.drinkType}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError id="drink-type-error" message={errors.drinkType} />
        </div>

        {selectedCategory &&
          selectedCategory.variants.length > 0 &&
          !selectedSavedDrink && (
            <div className="form-field">
              <label htmlFor="drink-variant">Drink subtype (optional)</label>
              <select
                id="drink-variant"
                name="drinkVariant"
                value={selectedVariantId ?? ''}
                onChange={(event) => handleVariantChange(event.target.value)}
                aria-describedby="drink-variant-help"
              >
                <option value="">No subtype selected</option>
                {selectedCategory.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name}
                  </option>
                ))}
              </select>
              <FieldDescription id="drink-variant-help">
                Choose a subtype to see its reference serving sizes, or leave
                this optional field blank.
              </FieldDescription>
            </div>
          )}

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
            readOnly={Boolean(selectedSavedDrink)}
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
            disabled={!selectedCategory || Boolean(selectedSavedDrink)}
            required
          >
            <option value="">Select a serving size</option>
            {applicableServingSizes.map((servingSize) => (
              <option key={servingSize.id} value={String(servingSize.volumeMl)}>
                {servingSize.name} — {servingSize.volumeMl} mL
              </option>
            ))}
            {selectedCategory && (
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
              readOnly={Boolean(selectedSavedDrink)}
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
            readOnly={Boolean(selectedSavedDrink)}
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

        <div className="form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={isPersisting}
          >
            Save drinking record
          </button>
          {!selectedSavedDrink && (
            <button
              className="secondary-button"
              type="button"
              onClick={handleSaveForFutureUse}
              disabled={isPersisting}
            >
              Save this drink to My Drinks
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
