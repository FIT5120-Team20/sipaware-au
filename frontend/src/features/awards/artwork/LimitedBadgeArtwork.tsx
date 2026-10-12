import { getLimitedBadgeArtwork } from './badgeArtwork'

/** Approved PNG illustration with live SVG year text; the illustration remains raster artwork. */
export function LimitedBadgeArtwork({ assetId, year }: { assetId: string; year: number }) {
  const artwork = getLimitedBadgeArtwork(assetId)
  if (!artwork) return null
  return <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <image href={artwork.image} width="100" height="100" />
    <text x="50" y="88" textAnchor="middle" fontSize="8.5" fontWeight="600"
      fill="#fffaf1" stroke={artwork.yearOutline} strokeWidth=".9" strokeLinejoin="round"
      paintOrder="stroke" letterSpacing=".25">{String(year).padStart(4, '0')}</text>
  </svg>
}
