import { getAustralianSeason, SEASONAL_BADGE_ARTWORK } from './badgeArtwork'

/** Date-free SVG backgrounds are isolated image documents, so their IDs cannot collide. */
export function MonthlyBadgeArtwork({ month, year }: { month: number; year: number }) {
  const artwork = SEASONAL_BADGE_ARTWORK[getAustralianSeason(month)]
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <image href={artwork.image} width="100" height="100" />
    <text x="50" y="55" textAnchor="middle" fontSize="28" fontWeight="700"
      fill={artwork.monthColour}>{String(month).padStart(2, '0')}</text>
    <text x="50" y="64" textAnchor="middle" fontSize="8.5" fontWeight="600"
      fill={artwork.yearColour}>{String(year).padStart(4, '0')}</text>
  </svg>
}
