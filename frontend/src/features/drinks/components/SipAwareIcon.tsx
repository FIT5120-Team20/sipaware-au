/**
 * Small, dependency-free icon set used by the Record a Drink experience.
 *
 * Icons are presentational companions to visible labels, never the only way an
 * action or state is communicated. Keeping the SVGs here also gives navigation,
 * drink choices, and information cards one consistent visual language.
 */
import type { SVGProps } from 'react'

import type { DrinkType } from '../types/drinkingRecord'

export type SipAwareIconName =
  | 'about'
  | 'arrow'
  | 'calendar'
  | 'car'
  | 'chart'
  | 'check'
  | 'clock'
  | 'learn'
  | 'record'
  | 'saved'
  | DrinkType

interface SipAwareIconProps extends SVGProps<SVGSVGElement> {
  name: SipAwareIconName
}

export function SipAwareIcon({ name, ...props }: SipAwareIconProps) {
  const sharedProps: SVGProps<SVGSVGElement> = {
    'aria-hidden': true,
    fill: 'none',
    focusable: false,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    ...props,
  }

  switch (name) {
    case 'record':
      return (
        <svg {...sharedProps}>
          <path d="M8.5 6.5h7l1 14h-9l1-14Z" />
          <path d="M10 6.5V4a2 2 0 0 1 4 0v2.5M10 11h4" />
        </svg>
      )
    case 'saved':
      return (
        <svg {...sharedProps}>
          <path d="M5 7.5h14v12H5zM8 7.5V4h8v3.5" />
          <path d="M9 12h6M10.5 15h3" />
        </svg>
      )
    case 'learn':
      return (
        <svg {...sharedProps}>
          <path d="M4 5.5c3.2-.6 5.9.1 8 2v11c-2.1-1.9-4.8-2.6-8-2V5.5Z" />
          <path d="M20 5.5c-3.2-.6-5.9.1-8 2v11c2.1-1.9 4.8-2.6 8-2V5.5Z" />
        </svg>
      )
    case 'about':
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.8v5M12 7.5h.01" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...sharedProps}>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M7.5 3v4M16.5 3v4M3.5 9h17M8 13h.01M12 13h.01M16 13h.01" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...sharedProps}>
          <path d="M5 19v-5M10 19V9M15 19V5M20 19V11" />
        </svg>
      )
    case 'car':
      return (
        <svg {...sharedProps}>
          <path d="m5 10 1.5-4h11L19 10l1.5 2v5H19v2h-3v-2H8v2H5v-2H3.5v-5L5 10Z" />
          <path d="M5 10h14M7.5 13.5h.01M16.5 13.5h.01" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...sharedProps}>
          <path d="M5 12h14M14 7l5 5-5 5" />
        </svg>
      )
    case 'check':
      return (
        <svg {...sharedProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      )
    case 'beer':
      return (
        <svg {...sharedProps}>
          <path d="M6 7h9v13H6zM15 9h2a3 3 0 0 1 0 6h-2" />
          <path d="M7 7V5.5A2.5 2.5 0 0 1 11.5 4 2.5 2.5 0 0 1 15 6v1M9 10v7M12 10v7" />
        </svg>
      )
    case 'wine':
      return (
        <svg {...sharedProps}>
          <path d="M7 4h10l-1 6a4.1 4.1 0 0 1-8 0L7 4ZM12 14v6M9 20h6M8 8h8" />
        </svg>
      )
    case 'spirits':
    case 'cocktail':
      return (
        <svg {...sharedProps}>
          <path d="M4 5h16l-8 9-8-9ZM12 14v6M9 20h6M7 8h10" />
        </svg>
      )
    case 'cider':
      return (
        <svg {...sharedProps}>
          <path d="M8 7h8l-1 13H9L8 7ZM10 7V4h4v3M9 11h6" />
          <path d="M16 4c1.5-.2 2.5-.9 3-2" />
        </svg>
      )
    case 'rtd-premixed':
      return (
        <svg {...sharedProps}>
          <path d="M8 4h8l1 16H7L8 4ZM8 8h8M9 4V2h6v2" />
        </svg>
      )
    case 'liqueur':
      return (
        <svg {...sharedProps}>
          <path d="M10 3h4v4l2.5 3v10h-9V10L10 7V3ZM8 12h8" />
        </svg>
      )
    default:
      return (
        <svg {...sharedProps}>
          <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}

/** Brand mark uses the same droplet motif as the approved visual direction. */
export function SipAwareBrandMark() {
  return (
    <svg
      className="site-brand__mark"
      viewBox="0 0 44 52"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22 2C17 10 5 18 5 32a17 17 0 0 0 34 0C39 18 27 10 22 2Z"
        fill="currentColor"
      />
      <path
        d="M22 13c-2 6-1 12 3 16 4 4 8 3 11 1-.8 10-6 16-14 16-7.8 0-14-6.3-14-14 0-7 5.6-12.4 14-19Z"
        fill="#ffffff"
        opacity=".82"
      />
      <path
        d="M22 13c-.7 5.2.6 9.5 4 12.7 3.1 2.9 6 3 9 1.9"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}
