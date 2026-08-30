/** Shared public-reference fixture for component tests; contains no personal data. */

import { mapDrinkReferenceCategories } from '../../../../frontend/src/features/drinks/config/drinkTypes'
import type {
  DrinkOptionsResponseDto,
  ReferenceSourceDto,
  ServingSizeDto,
} from '../../../../frontend/src/features/drinks/types/drinkReference'

const source: ReferenceSourceDto = {
  id: 5,
  name: 'Standard drinks guide',
  organisation: 'Australian Government Department of Health',
  url: 'https://example.invalid/reference',
}

function servingSize(
  id: number,
  name: string,
  volumeMl: number,
  variantId: number | null,
): ServingSizeDto {
  return { id, name, volumeMl, variantId, source }
}

export const DRINK_OPTIONS_RESPONSE: DrinkOptionsResponseDto = {
  categories: [
    {
      id: 1,
      name: 'Beer',
      variants: [
        { id: 1, name: 'Light beer' },
        { id: 2, name: 'Mid-strength beer' },
        { id: 3, name: 'Full-strength beer' },
      ],
      servingSizes: [
        servingSize(1, 'Small glass', 285, null),
        servingSize(2, 'Bottle / can', 375, null),
        servingSize(3, 'Large glass', 425, null),
      ],
      abvOptions: [
        {
          id: 1,
          abvPercent: 2.7,
          referenceLevel: 'SUBTYPE',
          referenceOption: 'Light beer',
          variantId: 1,
          applicationTreatment: 'Treat as an estimate',
          source,
        },
        {
          id: 4,
          abvPercent: 4.9,
          referenceLevel: 'FALLBACK',
          referenceOption: 'Full-strength beer reference',
          variantId: 3,
          applicationTreatment: 'Use only as a fallback estimate',
          source,
        },
      ],
    },
    {
      id: 2,
      name: 'Wine',
      variants: [
        { id: 4, name: 'Red wine' },
        { id: 5, name: 'White wine' },
        { id: 6, name: 'Champagne' },
        { id: 7, name: 'Fortified wine' },
      ],
      servingSizes: [
        servingSize(4, 'Standard serve', 100, 4),
        servingSize(5, 'Average restaurant serving', 150, 4),
        servingSize(6, 'Bottle', 750, 4),
        servingSize(7, 'Standard serve', 100, 5),
        servingSize(8, 'Average restaurant serving', 150, 5),
        servingSize(9, 'Bottle', 750, 5),
        servingSize(10, 'Average restaurant serving', 150, 6),
        servingSize(11, 'Bottle', 750, 6),
        servingSize(12, 'Standard serve', 60, 7),
      ],
      abvOptions: [
        {
          id: 5,
          abvPercent: 13,
          referenceLevel: 'GENERAL',
          referenceOption: 'Wine',
          variantId: null,
          applicationTreatment: 'Treat as an estimate',
          source,
        },
      ],
    },
    {
      id: 3,
      name: 'Cider',
      variants: [],
      servingSizes: [
        servingSize(13, 'Regular cider reference serve', 285, null),
      ],
      abvOptions: [],
    },
    {
      id: 4,
      name: 'Straight Spirits',
      variants: [],
      servingSizes: [
        servingSize(14, 'Nip / single serve', 30, null),
        servingSize(15, 'Bottle', 700, null),
      ],
      abvOptions: [],
    },
    {
      id: 5,
      name: 'RTD / Premixed',
      variants: [],
      servingSizes: [
        servingSize(16, 'Packaged serve', 250, null),
        servingSize(17, 'Packaged serve', 275, null),
        servingSize(18, 'Packaged serve', 300, null),
        servingSize(19, 'Packaged serve', 330, null),
        servingSize(20, 'Packaged serve', 375, null),
        servingSize(21, 'Packaged serve', 440, null),
        servingSize(22, 'Large packaged serve', 660, null),
      ],
      abvOptions: [],
    },
    {
      id: 6,
      name: 'Cocktail',
      variants: [],
      servingSizes: [],
      abvOptions: [],
    },
    {
      id: 7,
      name: 'Liqueur',
      variants: [],
      servingSizes: [],
      abvOptions: [],
    },
    {
      id: 8,
      name: 'Other',
      variants: [],
      servingSizes: [],
      abvOptions: [],
    },
  ],
}

export const DRINK_REFERENCE_CATEGORIES = mapDrinkReferenceCategories(
  DRINK_OPTIONS_RESPONSE,
)
