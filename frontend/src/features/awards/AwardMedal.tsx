import type { AwardPresentation } from './awardPresentation'
import { FIXED_BADGE_IMAGES } from './artwork/badgeArtwork'
import { MonthlyBadgeArtwork } from './artwork/MonthlyBadgeArtwork'
import { LimitedBadgeArtwork } from './artwork/LimitedBadgeArtwork'

type MedalSize = 'preview' | 'collection' | 'featured' | 'detail' | 'notice'

/** One circular badge renderer for previews, collections, details and earned notices. */
export function AwardMedal({ award, size = 'collection', decorative = false }: {
  award: AwardPresentation; size?: MedalSize; decorative?: boolean
}) {
  const month = award.medal.month ?? award.month
  const year = award.medal.year ?? award.year
  const fixedImage = award.medal.source ?? FIXED_BADGE_IMAGES[award.id]
  const label = `${award.name} badge, ${award.status === 'earned' ? 'earned' : 'not yet earned'}`
  return <span className={`award-medal award-medal--${size}${award.medal.state === 'desaturated' ? ' award-medal--unearned' : ''}`}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
    {award.eligibility === 'monthly' && month !== undefined && year !== undefined
      ? <MonthlyBadgeArtwork month={month} year={year} />
      : award.eligibility === 'limited-edition' && year !== undefined
        ? <LimitedBadgeArtwork assetId={award.medal.assetId} year={year} />
        : fixedImage ? <img src={fixedImage} alt="" decoding="async" /> : null}
  </span>
}
