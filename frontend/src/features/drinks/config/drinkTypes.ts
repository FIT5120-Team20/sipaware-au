import type { DrinkType } from '../types/drinkingRecord'

export interface DrinkTypeConfig {
  value: DrinkType
  label: string
  servingSizesMl: readonly number[]
}

export const DRINK_TYPE_CONFIG: readonly DrinkTypeConfig[] = [
  {
    value: 'beer',
    label: 'Beer',
    servingSizesMl: [285, 375, 425],
  },
  {
    value: 'wine',
    label: 'Wine',
    servingSizesMl: [100, 150],
  },
  {
    value: 'cider',
    label: 'Cider',
    servingSizesMl: [330, 375],
  },
  {
    value: 'spirits',
    label: 'Spirits',
    servingSizesMl: [30, 60],
  },
  {
    value: 'other',
    label: 'Other',
    servingSizesMl: [],
  },
]

export function isDrinkType(value: unknown): value is DrinkType {
  return DRINK_TYPE_CONFIG.some((drinkType) => drinkType.value === value)
}

export function getDrinkTypeConfig(
  value: string,
): DrinkTypeConfig | undefined {
  return DRINK_TYPE_CONFIG.find((drinkType) => drinkType.value === value)
}

export function getDrinkTypeLabel(value: DrinkType): string {
  return getDrinkTypeConfig(value)?.label ?? value
}
