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
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { RECORD_HOME_EVENT } from '../../../app/entryPaths'

import {
  DRINK_TYPE_COMPATIBILITY,
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
  getRecordEntryLimits,
  validateManualDrinkInput,
  validateReusableDrinkInput,
} from '../validation/drinkingRecordValidation'
import { IcoCalendar, IcoClock, MinusIcon, PlusIcon } from './ReferenceRecordBrowser'
import { SavedDrinkPicker } from './SavedDrinkPicker'
import { useConsumptionTimeLimit } from '../hooks/useConsumptionTimeLimit'
import { calculateStandardDrinks } from '../calculations/standardDrinks'
import { BarcodeScanner } from './BarcodeScanner'
import { selectCatalogProduct, type CatalogProduct } from '../catalog/catalogApi'
import { selectBarcodeProduct, type BarcodeLookup, type BarcodeProduct } from '../barcode/barcodeLookup'
import { ReferenceBackBar } from './ReferenceBackBar'
import { LabelScanner } from './LabelScanner'
import { prefillLabelFields, type LabelOcrResult } from '../ocr/labelOcr'

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
const FALLBACK_REFERENCE_CATEGORIES: readonly DrinkReferenceCategory[] =
  DRINK_TYPE_COMPATIBILITY.map(({ categoryId, value, fallbackLabel }) => ({
    id: categoryId,
    name: fallbackLabel,
    drinkType: value,
    variants: [],
    servingSizes: [],
    abvOptions: [],
  }))

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
  // Provenance travels with each independent record/template snapshot.
  // It never links history to mutable catalog or My Drinks rows.
  const [recordSource, setRecordSource] = useState<'manual' | 'database'>('manual')
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [labelScanKey, setLabelScanKey] = useState(0)
  const [captureView, setCaptureView] = useState<'browse' | 'manual'>(startInBrowse ? 'browse' : 'manual')
  const [showManualReferenceStatus, setShowManualReferenceStatus] = useState(false)

  // Keep the form mounted across capture views, but start or abandon actions
  // reset the draft so one unfinished record cannot leak into the next.
  function openManualEntry() {
    resetRecordDraft()
    setShowManualReferenceStatus(true)
    setCaptureView('manual')
    requestAnimationFrame(() => document.getElementById('drink-type')?.focus())
  }
  const [amountMode, setAmountMode] = useState<'serving' | 'ml'>('serving')
  const [blockedStepperKey, setBlockedStepperKey] = useState<string | null>(null)
  const [millilitres, setMillilitres] = useState('')
  const [saveTemplateWithRecord, setSaveTemplateWithRecord] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const recordLimitNoticeRef = useRef<HTMLDivElement>(null)
  const timeLimit = useConsumptionTimeLimit()
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
  const resetRecordDraft = useCallback(() => {
    setValues(createInitialManualDrinkFormValues())
    setAmountMode('serving')
    setMillilitres('')
    setBlockedStepperKey(null)
    setSaveTemplateWithRecord(false)

    setErrors({})
    setSaveStatus(null)

    setRecordSource('manual')
    setSelectedSavedDrinkId(null)
    setSelectedVariantId(null)

    setBarcodeOpen(false)
    setLabelScanKey(key => key + 1)
    setShowManualReferenceStatus(false)
  }, [setSaveTemplateWithRecord])
  useEffect(() => {
    const returnToRecordHome = () => {
      resetRecordDraft()
      setCaptureView('browse')
    }

    window.addEventListener(RECORD_HOME_EVENT, returnToRecordHome)
    return () => window.removeEventListener(RECORD_HOME_EVENT, returnToRecordHome)
  }, [resetRecordDraft])

  const selectableReferenceCategories =
    referenceStatus === 'loaded'
      ? referenceCategories
      : FALLBACK_REFERENCE_CATEGORIES

  const availableCategories = includePersistedDrinkType(
    selectableReferenceCategories,
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
  const consumedMl =
    servingVolume * Number(effectiveValues.amountConsumed)

  const entryLimits = getRecordEntryLimits(
    servingVolume,
    Number(values.abvPercent),
  )

  const volumeReady = entryLimits !== null
  const maximumServings = entryLimits?.maxServings
  const maximumMl = entryLimits?.maxVolumeMl
  // Keep a blocked step tied to its input snapshot. Changing any input clears
  // the displayed limit immediately, without a state-reset effect/re-render.
  const stepperInputKey = JSON.stringify([amountMode, millilitres, values.amountConsumed, values.abvPercent, servingVolume])
  const stepperLimitReached = blockedStepperKey === stepperInputKey


  const overLimit =
    maximumServings !== undefined &&
    Number(effectiveValues.amountConsumed) > maximumServings

  const atLimit =
    maximumServings !== undefined &&
    Number(effectiveValues.amountConsumed) >= maximumServings &&
    !overLimit

  const amountError = overLimit ? undefined : errors.amountConsumed
  const abvPercent = Number(values.abvPercent)
  const amountConsumed = Number(effectiveValues.amountConsumed)

  const estimate = calculateStandardDrinks({
    servingVolumeMl: servingVolume,
    abvPercent,
    amountConsumed,
  })

  const estimateAvailable =
    Number.isFinite(servingVolume) &&
    servingVolume > 0 &&
    values.abvPercent.trim() !== '' &&
    Number.isFinite(abvPercent) &&
    abvPercent > 0 &&
    abvPercent <= 100 &&
    effectiveValues.amountConsumed.trim() !== '' &&
    Number.isFinite(amountConsumed) &&
    amountConsumed > 0 &&
    Number.isFinite(estimate)

  const recordLimitNotice = overLimit
    ? {
      title: 'Are you sure you drank this much?',
      body: 'Check the amount you entered and try again.',
    }
    : atLimit || stepperLimitReached
      ? {
        title: 'You’ve reached the limit for this record',
        body: 'Does this amount look right?',
      }
      : null
  useEffect(() => {
    if (!overLimit && !atLimit && !stepperLimitReached) return

    recordLimitNoticeRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'center',
    })
  }, [overLimit, atLimit, stepperLimitReached])

  function switchAmountMode(mode: 'serving' | 'ml') {
    if (mode === amountMode) return
    if (mode === 'ml') setMillilitres(values.amountConsumed.trim() && servingVolume > 0 ? String(consumedMl) : '')
    else updateValue('amountConsumed', effectiveValues.amountConsumed)
    setAmountMode(mode)
  }
  function adjustAmount(delta: number) {
    if (amountMode === 'ml') {
      if (!volumeReady || maximumMl === undefined) return

      const current = Number(millilitres || 0)
      const next = Math.max(0, current + delta)

      if (delta > 0 && next > maximumMl) {
        setBlockedStepperKey(stepperInputKey)
        return
      }

      setBlockedStepperKey(null)
      setMillilitres(String(next))
      clearErrors('amountConsumed')
      setSaveStatus(null)
    } else {
      if (maximumServings === undefined) return

      const current = Number(values.amountConsumed || 0)
      const next = Math.max(0, current + delta)

      if (delta > 0 && next > maximumServings) {
        setBlockedStepperKey(stepperInputKey)
        return
      }

      setBlockedStepperKey(null)

      updateValue(
        'amountConsumed',
        String(next),
      )
    }
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
    setBlockedStepperKey(null)
  }

  function handleDrinkTypeChange(value: DrinkType | '') {
    const category = getDrinkReferenceCategory(availableCategories, value)
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
    resetRecordDraft()
    setRecordSource(savedDrink.recordSource ?? 'manual')
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

  /** Product selection starts a fresh draft; consumption must be entered for this occasion. */
  function handleBarcodeProduct(product: BarcodeProduct) {
    resetRecordDraft()
    setRecordSource('database')
    setValues((current) => selectBarcodeProduct(current, product))
    setSelectedSavedDrinkId(null)
    setSelectedVariantId(null)
    clearErrors(...REUSABLE_DRINK_FIELDS)
    setSaveStatus({ kind: 'success', message: 'Drink found. Check the serving size and ABV, and correct them if needed.' })
    setBarcodeOpen(false)
    queueMicrotask(() => {
      const field = formRef.current?.elements.namedItem('drinkName')
      if (field instanceof HTMLElement) field.focus()
    })
  }

  function handleCatalogProduct(product: CatalogProduct) {
    resetRecordDraft()
    setRecordSource('database')
    setValues(current => selectCatalogProduct(current, product))
    setSelectedSavedDrinkId(null)
    setSelectedVariantId(null)
    clearErrors(...REUSABLE_DRINK_FIELDS)
    setCaptureView('manual')
    setSaveStatus({ kind: 'success', message: 'Drink selected. Check the serving size and ABV, and correct them if needed.' })
    queueMicrotask(() => {
      const field = formRef.current?.elements.namedItem('drinkName')
      if (field instanceof HTMLElement) field.focus()
    })
  }

  function handleLabelResult(result: LabelOcrResult) {
    setValues(current => prefillLabelFields(current, result))
    // OCR is user-reviewed manual entry, never a database product identity.
    setRecordSource('manual')
    clearErrors(...REUSABLE_DRINK_FIELDS)
  }

  function returnToManualEntry() {
    resetRecordDraft()
    setShowManualReferenceStatus(true)
    queueMicrotask(() => {
      const field = formRef.current?.elements.namedItem('drinkName')
      if (field instanceof HTMLElement) field.focus()
    })
  }

  function clearSavedDrinkSelection() {
    setRecordSource('manual')
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

    const record = createDrinkingRecord({ ...validationResult.data, recordSource })
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
        try { await onSaveSavedDrink(createSavedDrink({ ...reusable.data, recordSource })) }
        catch { templateFailed = true }
      }
    }
    setIsPersisting(false)
    setErrors({})
    setAmountMode('serving')
    setMillilitres('')
    setSaveTemplateWithRecord(false)
    setValues(createInitialManualDrinkFormValues())
    setRecordSource('manual')
    setLabelScanKey(key => key + 1)
    setSelectedSavedDrinkId(null)
    setSaveStatus({
      kind: templateFailed ? 'error' : 'success',
      message: templateFailed ? 'Drinking record saved on this device, but the drink could not be saved to My Drinks. Do not record the same occasion again.' : 'Drinking record saved on this device.',
    })
    // Navigate only after both independent writes settle so a template failure
    // remains visible after navigation and cannot invite a duplicate record.
    onRecorded?.(record, templateFailed)
  }

  return (
    <section className={"manual-drink-card prototype-capture prototype-capture--" + captureView} aria-label="Drink capture">
      {startInBrowse && captureView === 'manual' &&
        <ReferenceBackBar label="Back to Record" onClick={() => {
          resetRecordDraft()
          setCaptureView('browse')
        }} />}
      <div hidden={captureView !== 'manual'} className="prototype-form-heading">
        <h1 id="manual-drink-title">{selectedSavedDrink ? 'Record Consumption' : 'Record a Drink'}</h1>
        <p>{selectedSavedDrink ? 'Tell us how much you drank.' : 'Enter the drink details and how much you drank.'}</p>
        {captureView === 'manual' && !selectedSavedDrink && <LabelScanner key={labelScanKey}
          disabled={isPersisting} onResult={handleLabelResult} />}
      </div>
      {barcodeOpen && <BarcodeScanner onBack={() => setBarcodeOpen(false)}
        onUseDrink={(product) => { setCaptureView('manual'); handleBarcodeProduct(product) }}
        onAddManually={() => { setCaptureView('manual'); returnToManualEntry() }} lookup={barcodeLookup} />}

      {captureView === 'manual' && saveStatus && (
        <div
          className={`form-notice form-notice--${saveStatus.kind}`}
          role={saveStatus.kind === 'error' ? 'alert' : 'status'}
          aria-live={saveStatus.kind === 'error' ? 'assertive' : 'polite'}
        >
          {saveStatus.message}
        </div>
      )}

      {captureView === 'manual' && showManualReferenceStatus && referenceStatus === 'loading' && (
        <div className="form-notice" role="status">
          Loading current drink reference options...
        </div>
      )}

      {captureView === 'manual' && showManualReferenceStatus && referenceStatus === 'failed' && (
        <div className="form-notice form-notice--error" role="alert">
          <p>
            Drink reference options are temporarily unavailable. You can still record
            this drink by entering a custom serving volume and the ABV shown on its label.
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
      <form
        className="prototype-consumption-form"
        ref={formRef}
        onSubmit={handleSubmit}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.nativeEvent.isComposing &&
            !(event.target instanceof HTMLButtonElement)
          ) {
            event.preventDefault()
          }
        }}
        noValidate
        hidden={captureView !== 'manual'}
      >
        {/* Step wrappers change only visual grouping. The original named
            controls remain the sole source of form state and validation. */}
        {startInBrowse && selectedSavedDrink && <div className="prototype-drink-summary">
          <strong>{selectedSavedDrink.drinkName}</strong><p>{selectedCategory?.name ?? selectedSavedDrink.drinkType}<span className="prototype-detail-separator">·</span>{values.abvPercent}% ABV<span className="prototype-detail-separator">·</span>{values.customVolumeMl} mL serving</p>
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
                      min="0"
                      inputMode="decimal"
                      step="any"
                      placeholder="e.g. 375"
                      readOnly={Boolean(selectedSavedDrink)}
                      value={values.customVolumeMl}
                      onChange={(event) =>
                        updateValue(
                          'customVolumeMl',
                          Number(event.target.value) < 0 ? '0' : event.target.value,
                        )
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
                    min="0"
                    inputMode="decimal"
                    step="any"
                    max="100"
                    placeholder="e.g. 4.5"
                    readOnly={Boolean(selectedSavedDrink)}
                    value={values.abvPercent}
                    onChange={(event) =>
                      updateValue(
                        'abvPercent',
                        Number(event.target.value) < 0 ? '0' : event.target.value,
                      )
                    }
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
            <button type="button" disabled={!volumeReady} aria-pressed={amountMode === 'ml'} onClick={() => switchAmountMode('ml')}>By mL</button>
          </div>
          <div className="prototype-amount-panel">
            {amountMode === 'serving' && <p>1 serving = {servingVolume > 0 ? servingVolume : '—'} mL</p>}
            <div className="prototype-amount-stepper">
              <button type="button" aria-label={amountMode === 'serving' ? 'Decrease servings' : 'Decrease mL'} onClick={() => adjustAmount(amountMode === 'serving' ? -0.5 : -50)}><MinusIcon /></button>
              <div>
                {amountMode === 'serving' ? <input id="amount-consumed" name="amountConsumed" type="number" inputMode="decimal" min="0" max={maximumServings} step="any" placeholder="0.0"
                  value={values.amountConsumed} onChange={e => updateValue('amountConsumed', e.target.value)}
                  aria-label="Number of servings consumed" aria-invalid={Boolean(amountError)} aria-describedby="amount-consumed-help amount-consumed-error" required />
                  : <input id="consumed-ml" name="consumedMl" type="number" inputMode="decimal" min="0" max={maximumMl} disabled={!volumeReady} step="any" placeholder="0"
                    value={millilitres} onChange={e => { setMillilitres(e.target.value); clearErrors('amountConsumed'); setSaveStatus(null) }}
                    aria-label="Amount in mL" aria-invalid={Boolean(amountError)} aria-describedby="amount-consumed-help amount-consumed-error" required />}
                <span>{amountMode === 'serving' ? 'Servings' : 'mL'}</span>
              </div>
              <button
                type="button"
                aria-label={
                  amountMode === 'serving'
                    ? 'Increase servings'
                    : 'Increase mL'
                }
                disabled={
                  overLimit ||
                  stepperLimitReached ||
                  (amountMode === 'serving'
                    ? maximumServings === undefined ||
                    Number(effectiveValues.amountConsumed) >= maximumServings
                    : maximumMl === undefined ||
                    Number(millilitres || 0) >= maximumMl)
                }
                onClick={() =>
                  adjustAmount(amountMode === 'serving' ? 0.5 : 50)
                }
              >
                <PlusIcon />
              </button>
            </div>
            <p className="field-help" id="amount-consumed-help">
              {amountMode === 'serving'
                ? 'Enter the number of servings consumed, for example 1.5.'
                : 'Enter the total volume you consumed in mL.'}
            </p>
            <FieldError id="amount-consumed-error" message={amountError} />
          </div>
          {recordLimitNotice && (
            <div
              ref={recordLimitNoticeRef}
              className={`record-limit-notice ${overLimit
                ? 'record-limit-notice--warning'
                : 'record-limit-notice--status'
                }`}
              role={overLimit ? 'alert' : 'status'}
            >
              <span className="record-limit-notice__icon" aria-hidden="true">
                !
              </span>
              <div className="record-limit-notice__content">
                <strong>{recordLimitNotice.title}</strong>
                <p>{recordLimitNotice.body}</p>
              </div>
            </div>
          )}

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
                max={timeLimit.date}
                onFocus={timeLimit.refresh}
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
                max={values.date === timeLimit.date ? timeLimit.time : undefined}
                onFocus={timeLimit.refresh}
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
            disabled={isPersisting || overLimit}
          >
            Record Drink
          </button>

        </div>
      </form>
    </section>
  )
}
