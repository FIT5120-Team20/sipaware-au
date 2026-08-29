import type { DrinkType } from '../types/drinkingRecord'
import type {
  DrinkOptionsResponseDto,
  DrinkReferenceCategory,
  ServingSizeDto,
} from '../types/drinkReference'

export interface DrinkTypeCompatibility {
  categoryId: number
  value: DrinkType
  fallbackLabel: string
}

/**
 * Neon category IDs map to stable local values used by existing IndexedDB
 * objects. Fallback labels support historical display if the public reference
 * API is temporarily unavailable; they are not runtime serving-size data.
 */
export const DRINK_TYPE_COMPATIBILITY: readonly DrinkTypeCompatibility[] = [
  { categoryId: 1, value: 'beer', fallbackLabel: 'Beer' },
  { categoryId: 2, value: 'wine', fallbackLabel: 'Wine' },
  { categoryId: 3, value: 'cider', fallbackLabel: 'Cider' },
  { categoryId: 4, value: 'spirits', fallbackLabel: 'Spirits' },
  { categoryId: 5, value: 'rtd-premixed', fallbackLabel: 'RTD / Premixed' },
  { categoryId: 6, value: 'cocktail', fallbackLabel: 'Cocktail' },
  { categoryId: 7, value: 'liqueur', fallbackLabel: 'Liqueur' },
  { categoryId: 8, value: 'other', fallbackLabel: 'Other' },
]

export function isDrinkType(value: unknown): value is DrinkType {
  return DRINK_TYPE_COMPATIBILITY.some(
    (drinkType) => drinkType.value === value,
  )
}

export function getDrinkTypeForCategoryId(
  categoryId: number,
): DrinkType | undefined {
  return DRINK_TYPE_COMPATIBILITY.find(
    (compatibility) => compatibility.categoryId === categoryId,
  )?.value
}

export function mapDrinkReferenceCategories(
  response: DrinkOptionsResponseDto,
): DrinkReferenceCategory[] {
  const seenDrinkTypes = new Set<DrinkType>()
  const categories = response.categories.map((category) => {
    const drinkType = getDrinkTypeForCategoryId(category.id)
    if (!drinkType || seenDrinkTypes.has(drinkType)) {
      throw new Error('Drink categories did not match the compatibility model')
    }

    seenDrinkTypes.add(drinkType)
    return { ...category, drinkType }
  })

  if (seenDrinkTypes.size !== DRINK_TYPE_COMPATIBILITY.length) {
    throw new Error('Drink categories did not match the compatibility model')
  }

  return categories
}

export function getDrinkReferenceCategory(
  categories: readonly DrinkReferenceCategory[],
  value: string,
): DrinkReferenceCategory | undefined {
  return categories.find((category) => category.drinkType === value)
}

export function getDrinkTypeLabel(
  value: DrinkType,
  categories: readonly DrinkReferenceCategory[] = [],
): string {
  return (
    getDrinkReferenceCategory(categories, value)?.name ??
    DRINK_TYPE_COMPATIBILITY.find(
      (compatibility) => compatibility.value === value,
    )?.fallbackLabel ??
    value
  )
}

/**
 * Keep a persisted category selectable in an editor even while the API is
 * unavailable. The synthetic entry contains no reference choices and never
 * rewrites the historical object.
 */
export function includePersistedDrinkType(
  categories: readonly DrinkReferenceCategory[],
  persistedDrinkType: DrinkType | '',
): readonly DrinkReferenceCategory[] {
  if (
    !persistedDrinkType ||
    getDrinkReferenceCategory(categories, persistedDrinkType)
  ) {
    return categories
  }

  const compatibility = DRINK_TYPE_COMPATIBILITY.find(
    (item) => item.value === persistedDrinkType,
  )
  if (!compatibility) {
    return categories
  }

  return [
    ...categories,
    {
      id: compatibility.categoryId,
      drinkType: compatibility.value,
      name: compatibility.fallbackLabel,
      variants: [],
      servingSizes: [],
      abvOptions: [],
    },
  ]
}

/** Preserve backend scope: category-wide rows plus the selected variant only. */
export function getApplicableServingSizes(
  category: DrinkReferenceCategory | undefined,
  selectedVariantId: number | null,
): ServingSizeDto[] {
  if (!category) {
    return []
  }

  return category.servingSizes.filter(
    (servingSize) =>
      servingSize.variantId === null ||
      servingSize.variantId === selectedVariantId,
  )
}
