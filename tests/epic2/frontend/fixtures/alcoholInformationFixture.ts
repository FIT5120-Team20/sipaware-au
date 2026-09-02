import type { AlcoholInformationResponseDto } from '../../../../frontend/src/features/drinks/types/alcoholInformation'

export const ALCOHOL_INFORMATION_RESPONSE: AlcoholInformationResponseDto = {
  topics: [
    {
      topicCode: 'STANDARD_DRINK',
      displayName: 'What is a Standard Drink?',
      displayOrder: 1,
      content: [
        {
          id: 1,
          title: 'Understanding a standard drink',
          contentType: 'PROJECT_SUMMARY',
          bodyText: 'Verified standard drink fixture content.',
          displayOrder: 1,
          lastVerified: '2026-08-29',
          sources: [
            {
              id: 2,
              role: 'PRIMARY',
              name: 'Standard drink primary source',
              organisation: 'Australian Government',
              url: 'https://example.invalid/standard-primary',
            },
            {
              id: 3,
              role: 'SUPPORTING',
              name: 'Standard drink supporting source',
              organisation: 'NHMRC',
              url: 'https://example.invalid/standard-supporting',
            },
          ],
        },
      ],
    },
    {
      topicCode: 'ALCOHOL_GUIDELINES',
      displayName: 'Australian alcohol guidelines',
      displayOrder: 2,
      content: [
        {
          id: 2,
          title: 'Guideline information',
          contentType: 'PROJECT_SUMMARY',
          bodyText: 'Verified guideline fixture content.',
          displayOrder: 1,
          lastVerified: '2026-08-29',
          sources: [
            {
              id: 4,
              role: 'PRIMARY',
              name: 'Australian alcohol guidelines',
              organisation: 'NHMRC',
              url: 'https://example.invalid/guidelines',
            },
          ],
        },
      ],
    },
    {
      topicCode: 'ALCOHOL_AGEING',
      displayName: 'Alcohol and ageing',
      displayOrder: 3,
      content: [
        {
          id: 3,
          title: 'Age-related information',
          contentType: 'PROJECT_SUMMARY',
          bodyText: 'Verified ageing fixture content.',
          displayOrder: 1,
          lastVerified: '2026-08-29',
          sources: [
            {
              id: 4,
              role: 'PRIMARY',
              name: 'Australian alcohol guidelines',
              organisation: 'NHMRC',
              url: 'https://example.invalid/guidelines',
            },
          ],
        },
      ],
    },
    {
      topicCode: 'ALCOHOL_DRIVING',
      displayName: 'Alcohol and driving',
      displayOrder: 4,
      content: [
        {
          id: 4,
          title: 'Driving safety information',
          contentType: 'PROJECT_SUMMARY',
          bodyText: 'Verified driving fixture content.',
          displayOrder: 1,
          lastVerified: '2026-08-29',
          sources: [
            {
              id: 7,
              role: 'PRIMARY',
              name: 'Australian road safety source',
              organisation: 'Australian Government',
              url: 'https://example.invalid/driving',
            },
          ],
        },
      ],
    },
    {
      topicCode: 'ALCOHOL_MEDICINES',
      displayName: 'Alcohol and medicines',
      displayOrder: 5,
      content: [
        {
          id: 5,
          title: 'Medicine information',
          contentType: 'PROJECT_SUMMARY',
          bodyText: 'Verified medicines fixture content.',
          displayOrder: 1,
          lastVerified: '2026-08-29',
          sources: [
            {
              id: 8,
              role: 'PRIMARY',
              name: 'Healthdirect medicines source',
              organisation: 'Healthdirect Australia',
              url: 'https://example.invalid/medicines',
            },
          ],
        },
      ],
    },
    {
      topicCode: 'ALCOHOL_LEGAL',
      displayName: 'Alcohol and the law',
      displayOrder: 6,
      content: [
        {
          id: 6,
          title: 'Legal information',
          contentType: 'PROJECT_SUMMARY',
          bodyText: 'Verified legal fixture content.',
          displayOrder: 1,
          lastVerified: '2026-08-29',
          sources: [
            {
              id: 6,
              role: 'PRIMARY',
              name: 'Australian alcohol law source',
              organisation: 'Australian Government',
              url: 'https://example.invalid/legal',
            },
          ],
        },
      ],
    },
  ],
}
