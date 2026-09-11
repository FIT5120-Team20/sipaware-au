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
import { IcoCalendar, IcoClock, MinusIcon, PlusIcon } from './ReferenceRecordBrowser'
import { SavedDrinkPicker } from './SavedDrinkPicker'
import { calculateStandardDrinks } from '../calculations/standardDrinks'
import { BarcodeScanner } from './BarcodeScanner'
import { selectCatalogProduct, type CatalogProduct } from '../catalog/catalogApi'
import { selectBarcodeProduct, type BarcodeLookup, type BarcodeProduct } from '../barcode/barcodeLookup'

interface ManualDrinkFormProps {
  startInBrowse?: boolean
  onRecorded?: (record: DrinkingRecord, templateFailed: boolean) => void
  barcodeLookup?: BarcodeLookup
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
  barcodeLookup,
  startInBrowse = false,
  onRecorded,
}: ManualDrinkFormProps) {
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [labelScanUnavailable, setLabelScanUnavailable] = useState(false)
  const [captureView, setCaptureView] = useState<'browse' | 'manual'>(startInBrowse ? 'browse' : 'manual')

  // The reference separates drink selection from occasion entry. Keep the form
  // mounted so returning from camera/selection never resets Date, Time or amount.
  function openManualEntry() {
    if (selectedSavedDrink) clearSavedDrinkSelection()
    setCaptureView('manual')
    requestAnimationFrame(() => document.getElementById('drink-type')?.focus())
  }
  const [amountMode, setAmountMode] = useState<'serving' | 'ml'>('serving')
  const [millilitres, setMillilitres] = useState('')
  const [saveTemplateWithRecord, setSaveTemplateWithRecord] = useState(false)
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

  const servingVolume = Number(isCustomVolume ? values.customVolumeMl : values.servingSizeSelection)
  // mL is a presentation mode. Convert once at the existing validation boundary;
  // the persisted record still stores a serving volume and an independent count.
  const effectiveValues = amountMode === 'ml' ? {
    ...values, amountConsumed: servingVolume > 0 && millilitres.trim() !== ''
      ? String(Number(millilitres) / servingVolume) : '',
  } : values
  const consumedMl = servingVolume * Number(effectiveValues.amountConsumed)
  const estimate = calculateStandardDrinks({
    servingVolumeMl: servingVolume, abvPercent: Number(values.abvPercent),
    amountConsumed: Number(effectiveValues.amountConsumed),
  })
  const estimateAvailable = servingVolume > 0 && Number(values.abvPercent) >= 0 &&
    values.abvPercent.trim() !== '' && effectiveValues.amountConsumed.trim() !== '' &&
    Number.isFinite(estimate) && Number(effectiveValues.amountConsumed) > 0
  function switchAmountMode(mode: 'serving' | 'ml') {
    if (mode === amountMode) return
    if (mode === 'ml') setMillilitres(values.amountConsumed.trim() && servingVolume > 0 ? String(consumedMl) : '')
    else updateValue('amountConsumed', effectiveValues.amountConsumed)
    setAmountMode(mode)
  }
  function adjustAmount(delta: number) {
    if (amountMode === 'ml') {
      setMillilitres(String(Math.max(0, Number(millilitres || 0) + delta)))
      clearErrors('amountConsumed')
    } else updateValue('amountConsumed', String(Math.max(0, Number(values.amountConsumed || 0) + delta)))
  }

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

  /** Product selection changes only reusable inputs; consumption remains explicit. */
  function handleBarcodeProduct(product: BarcodeProduct) {
    setValues((current) => selectBarcodeProduct(current, product))
    setSelectedSavedDrinkId(null)
    setSelectedVariantId(null)
    clearErrors(...REUSABLE_DRINK_FIELDS)
    setSaveStatus({ kind: 'success', message: 'Drink details added. Review the volume, servings, Date and Time before saving.' })
    setBarcodeOpen(false)
    queueMicrotask(() => {
      const field = formRef.current?.elements.namedItem('drinkName')
      if (field instanceof HTMLElement) field.focus()
    })
  }

  function handleCatalogProduct(product: CatalogProduct) {
    setValues(current => selectCatalogProduct(current, product))
    setSelectedSavedDrinkId(null)
    setSelectedVariantId(null)
    clearErrors(...REUSABLE_DRINK_FIELDS)
    setCaptureView('manual')
    setSaveStatus({ kind: 'success', message: 'Drink details added. Review the volume, servings, Date and Time before saving.' })
    queueMicrotask(() => {
      const field = formRef.current?.elements.namedItem('drinkName')
      if (field instanceof HTMLElement) field.focus()
    })
  }

  function returnToManualEntry() {
    // Release template field locks without discarding the user's current draft.
    setSelectedSavedDrinkId(null)
    setBarcodeOpen(false)
    queueMicrotask(() => {
      const field = formRef.current?.elements.namedItem('drinkName')
      if (field instanceof HTMLElement) field.focus()
    })
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
        formRef.current?.elements.namedItem(firstInvalidField === 'amountConsumed' && amountMode === 'ml' ? 'consumedMl' : firstInvalidField)
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

    const validationResult = validateManualDrinkInput(effectiveValues)
    if (!validationResult.success) {
      setErrors(validationResult.errors)
      setSaveStatus({
        kind: 'error',
        message: 'Check the highlighted fields before saving this record.',
      })
      focusFirstInvalidField(validationResult.errors)
      return
    }

    const record = createDrinkingRecord(validationResult.data)
    setIsPersisting(true)
    try {
      await onSave(record)
    } catch {
      setIsPersisting(false)
      setSaveStatus({
        kind: 'error',
        message:
          'This record could not be saved on this device. Your entries have been kept so you can try again.',
      })
      return
    }

    let templateFailed = false
    if (saveTemplateWithRecord && !selectedSavedDrink) {
      // These are separate stores: report a template failure truthfully after
      // a successful history write instead of retrying/duplicating that record.
      const reusable = validateReusableDrinkInput(values)
      if (reusable.success) {
        try { await onSaveSavedDrink(createSavedDrink(reusable.data)) }
        catch { templateFailed = true }
      }
    }
    setIsPersisting(false)
    setErrors({})
    setAmountMode('serving')
    setMillilitres('')
    setSaveTemplateWithRecord(false)
    setValues(createInitialManualDrinkFormValues())
    setSelectedSavedDrinkId(null)
    setSaveStatus({
      kind: templateFailed ? 'error' : 'success',
      message: templateFailed ? 'Drinking record saved on this device, but the drink could not be saved to My Drinks. Do not record the same occasion again.' : 'Drinking record saved on this device.',
    })
    // Navigate only after both independent writes settle so a template failure
    // remains visible on the result screen and cannot invite a duplicate record.
    onRecorded?.(record, templateFailed)
  }

  return (
    <section className={"manual-drink-card prototype-capture prototype-capture--" + captureView} aria-label="Drink capture">
      <div hidden={captureView !== 'manual'} className="prototype-form-heading">
        {startInBrowse && <button type="button" className="prototype-back" onClick={() => setCaptureView('browse')}><span aria-hidden="true">‹</span> Back to Record</button>}
        <h1 id="manual-drink-title">{selectedSavedDrink ? 'Record Consumption' : 'Record a Drink'}</h1>
        <p>{selectedSavedDrink ? 'Tell us how much you drank.' : 'Enter the drink details and how much you drank.'}</p>
        {/* Label scanning is a UI-only placeholder. Barcode capture remains on
            the Record browser; never substitute it or simulated OCR here. */}
        <div className="prototype-scan-card">
          <div className="prototype-scan-card-title">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M7 2H4a2 2 0 0 0-2 2v3M13 2h3a2 2 0 0 1 2 2v3M7 18H4a2 2 0 0 1-2-2v-3M13 18h3a2 2 0 0 0 2-2v-3" stroke="#647280" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="10" cy="10" r="2.5" stroke="#647280" strokeWidth="1.6" />
            </svg>
            <h2>Scan drink label</h2>
          </div>
          <p>Take or upload a photo of the label to help fill in the drink details automatically.</p>
          <button type="button" disabled={isPersisting} onClick={() => setLabelScanUnavailable(true)}>Scan Label</button>
          {labelScanUnavailable && <p role="status" style={{ margin: '12px 0 0' }}>
            Label scanning is not available yet. Please enter the drink details below.
          </p>}
        </div>
      </div>
      {barcodeOpen && <BarcodeScanner onBack={() => setBarcodeOpen(false)}
        onUseDrink={(product) => { setCaptureView('manual'); handleBarcodeProduct(product) }}
        onAddManually={() => { setCaptureView('manual'); returnToManualEntry() }} lookup={barcodeLookup} />}

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

      <div hidden={startInBrowse && captureView !== 'browse'}>
      <SavedDrinkPicker
        browserActions={startInBrowse ? { onScan: () => setBarcodeOpen(true), onManual: openManualEntry, onProduct: handleCatalogProduct } : undefined}
        referenceCategories={referenceCategories}
        savedDrinks={savedDrinks}
        selectedSavedDrinkId={selectedSavedDrinkId}
        onSelect={(drink) => { handleSavedDrinkSelect(drink); setCaptureView('manual') }}
        onClear={clearSavedDrinkSelection}
        onUpdate={handleSavedDrinkUpdate}
        onDelete={handleSavedDrinkDelete}
      />

      </div>
      <form className="prototype-consumption-form" ref={formRef} onSubmit={handleSubmit} noValidate hidden={captureView !== 'manual'}>
        {/* Step wrappers change only visual grouping. The original named
            controls remain the sole source of form state and validation. */}
        {startInBrowse && selectedSavedDrink && <div className="prototype-drink-summary">
          <strong>{selectedSavedDrink.drinkName}</strong><p>{selectedCategory?.name ?? selectedSavedDrink.drinkType} · {values.abvPercent}% ABV · {values.customVolumeMl} mL serving</p>
          <button type="button" className="text-button" onClick={clearSavedDrinkSelection}>Enter drink manually instead</button>
        </div>}
        <div hidden={startInBrowse && Boolean(selectedSavedDrink)}>
        <section className="form-step" aria-labelledby="drink-choice-title">
          <h3 id="drink-choice-title">Drink details</h3>
          <div className="form-field drink-type-field">
            <label htmlFor="drink-type">Drink type</label>
            <select
              id="drink-type"
              name="drinkType"
              value={values.drinkType}
              onChange={(event) =>
                handleDrinkTypeChange(event.target.value as DrinkType | '')
              }
              aria-invalid={Boolean(errors.drinkType)}
              aria-describedby={
                errors.drinkType ? 'drink-type-error' : undefined
              }
              disabled={
                Boolean(selectedSavedDrink) ||
                availableCategories.length === 0
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
            placeholder="e.g. Carlton Draught, house wine, vodka soda"
            readOnly={Boolean(selectedSavedDrink)}
            required
          />
          <FieldError id="drink-name-error" message={errors.drinkName} />
          </div>
        </section>

        <section className="form-step" aria-labelledby="drink-details-title">
          <h3 id="drink-details-title">Serving details</h3>
          <div className="form-details-grid">
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
            <div className="input-with-unit">
              <input
                id="custom-volume"
                name="customVolumeMl"
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="e.g. 375"
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
              <span aria-hidden="true">mL</span>
            </div>
            <FieldError
              id="custom-volume-error"
              message={errors.customVolumeMl}
            />
          </div>
        )}

        <div className="form-field">
          <label htmlFor="abv-percent">ABV (%)</label>
          <div className="input-with-unit">
            <input
              id="abv-percent"
              name="abvPercent"
              type="number"
              inputMode="decimal"
              step="any"
              max="100"
              placeholder="e.g. 4.5"
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
            <span aria-hidden="true">%</span>
          </div>
          <FieldDescription id="abv-help">
            Enter the alcohol percentage shown on the drink label.
          </FieldDescription>
          <FieldError id="abv-error" message={errors.abvPercent} />
            </div>
          </div>
        </section>

        </div>
        <section className="prototype-consumption" aria-labelledby="drink-amount-title">
          <h3 id="drink-amount-title">How much did you drink?</h3>
          <div className="prototype-amount-tabs" aria-label="Amount entry mode">
            <button type="button" aria-pressed={amountMode === 'serving'} onClick={() => switchAmountMode('serving')}>By serving</button>
            <button type="button" aria-pressed={amountMode === 'ml'} onClick={() => switchAmountMode('ml')}>By mL</button>
          </div>
          <div className="prototype-amount-panel">
            {amountMode === 'serving' && <p>1 serving = {servingVolume > 0 ? servingVolume : '—'} mL</p>}
            <div className="prototype-amount-stepper">
              <button type="button" aria-label={amountMode === 'serving' ? 'Decrease servings' : 'Decrease mL'} onClick={() => adjustAmount(amountMode === 'serving' ? -0.5 : -50)}><MinusIcon /></button>
              <div>
                {amountMode === 'serving' ? <input id="amount-consumed" name="amountConsumed" type="number" inputMode="decimal" step="any" placeholder="0.0"
                  value={values.amountConsumed} onChange={e => updateValue('amountConsumed', e.target.value)}
                  aria-label="Number of servings consumed" aria-invalid={Boolean(errors.amountConsumed)} aria-describedby="amount-consumed-help amount-consumed-error" required />
                  : <input id="consumed-ml" name="consumedMl" type="number" inputMode="decimal" step="any" placeholder="0"
                    value={millilitres} onChange={e => { setMillilitres(e.target.value); clearErrors('amountConsumed'); setSaveStatus(null) }}
                    aria-label="Amount in mL" aria-invalid={Boolean(errors.amountConsumed)} aria-describedby="amount-consumed-help amount-consumed-error" required />}
                <span>{amountMode === 'serving' ? 'Servings' : 'mL'}</span>
              </div>
              <button type="button" aria-label={amountMode === 'serving' ? 'Increase servings' : 'Increase mL'} onClick={() => adjustAmount(amountMode === 'serving' ? 0.5 : 50)}><PlusIcon /></button>
            </div>
            <p className="field-help" id="amount-consumed-help">{amountMode === 'serving' ? 'Enter the number of servings consumed, for example 1.5.' : 'Enter the total volume you consumed in mL.'}</p>
            <FieldError id="amount-consumed-error" message={errors.amountConsumed} />
          </div>
          <div className="prototype-estimate" aria-live="polite">
            <div><strong>Estimated standard drinks</strong><p>{estimateAvailable ? 'Based on ' + Number(consumedMl.toFixed(2)) + ' mL consumed and ' + values.abvPercent + '% ABV.' : 'Enter the serving size, ABV and amount consumed.'}</p></div>
            <div><p className="prototype-estimate-value">{estimateAvailable ? estimate.toFixed(1) : '—'}</p><span>standard drinks</span></div>
          </div>
        </section>

        <fieldset className="date-time-fields form-step">
          <legend>When did you drink?</legend>

          <div className="date-time-grid">
            <div className="form-field">
              <label htmlFor="consumed-date"><span aria-hidden="true"><IcoCalendar /></span> Date</label>
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
              <label htmlFor="consumed-time"><span aria-hidden="true"><IcoClock /></span> Time</label>
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

        {!selectedSavedDrink && <label className="prototype-save-template">
          <input type="checkbox" checked={saveTemplateWithRecord} onChange={e => setSaveTemplateWithRecord(e.target.checked)} />
          <span><strong>Save this drink to My Drinks</strong><span>Save these drink details so you can record it faster next time.</span></span>
        </label>}
        <div className="form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={isPersisting}
          >
            Record Drink
          </button>

        </div>
      </form>
    </section>
  )
}
