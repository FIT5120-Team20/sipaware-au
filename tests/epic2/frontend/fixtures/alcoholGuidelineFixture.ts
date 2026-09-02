import type { AlcoholGuidelinesResponseDto } from '../../../../frontend/src/features/drinks/types/alcoholGuideline'

export const ALCOHOL_GUIDELINES_RESPONSE: AlcoholGuidelinesResponseDto = {
  guidelines: [
    {
      id: 1,
      guidelineType: 'DAILY',
      thresholdStandardDrinks: 4,
      periodDescription: 'Any one day',
      guidelineText:
        'For healthy adults, no more than 4 standard drinks on any one day is recommended to reduce the risk of alcohol-related harm',
      source: {
        id: 4,
        name: 'Australian Guidelines to Reduce Health Risks from Drinking Alcohol',
        organisation: 'National Health and Medical Research Council (NHMRC)',
        url: 'https://example.invalid/nhmrc-guidelines',
      },
    },
    {
      id: 2,
      guidelineType: 'WEEKLY',
      thresholdStandardDrinks: 10,
      periodDescription: 'One week',
      guidelineText:
        'For healthy adults, no more than 10 standard drinks a week is recommended to reduce the risk of alcohol-related harm',
      source: {
        id: 4,
        name: 'Australian Guidelines to Reduce Health Risks from Drinking Alcohol',
        organisation: 'National Health and Medical Research Council (NHMRC)',
        url: 'https://example.invalid/nhmrc-guidelines',
      },
    },
  ],
}
