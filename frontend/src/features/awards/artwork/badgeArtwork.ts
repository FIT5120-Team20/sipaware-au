import type { AwardId, LimitedOccasionId } from '../awardDefinitions'
import firstStep from './fixed/first-step.png'
import knowYourPatterns from './fixed/know-your-patterns.png'
import keepingTrack from './fixed/keeping-track.png'
import fourteenDayMilestone from './fixed/14-day-milestone.png'
import buildingAHabit from './fixed/building-a-habit.png'
import worldHealthDay from './limited/world-health-day.png'
import worldHeartDay from './limited/world-heart-day.png'
import worldMentalHealthDay from './limited/world-mental-health-day.png'
import summer from './seasonal/summer.svg'
import autumn from './seasonal/autumn.svg'
import winter from './seasonal/winter.svg'
import spring from './seasonal/spring.svg'

/** Artwork references only; award identities and conditions remain in awardDefinitions. */
export const FIXED_BADGE_IMAGES: Readonly<Partial<Record<AwardId, string>>> = {
  'first-step': firstStep,
  'know-your-patterns': knowYourPatterns,
  'keeping-track': keepingTrack,
  '14-day-milestone': fourteenDayMilestone,
  'building-a-habit': buildingAHabit,
}

export type AustralianSeason = 'summer' | 'autumn' | 'winter' | 'spring'

export function getAustralianSeason(month: number): AustralianSeason {
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('A valid badge month is required.')
  if (month === 12 || month <= 2) return 'summer'
  if (month <= 5) return 'autumn'
  if (month <= 8) return 'winter'
  return 'spring'
}

export const SEASONAL_BADGE_ARTWORK: Readonly<Record<AustralianSeason, {
  image: string; monthColour: string; yearColour: string
}>> = {
  summer: { image: summer, monthColour: '#075c7d', yearColour: '#477d88' },
  autumn: { image: autumn, monthColour: '#ae4c1a', yearColour: '#946647' },
  winter: { image: winter, monthColour: '#205999', yearColour: '#4774a8' },
  spring: { image: spring, monthColour: '#287749', yearColour: '#4c805a' },
}

const LIMITED_BADGE_ARTWORK: Readonly<Record<LimitedOccasionId, { image: string; yearOutline: string }>> = {
  'world-health-day': { image: worldHealthDay, yearOutline: '#17675c' },
  'world-heart-day': { image: worldHeartDay, yearOutline: '#a83b53' },
  'world-mental-health-day': { image: worldMentalHealthDay, yearOutline: '#514489' },
}

export function getLimitedBadgeArtwork(assetId: string) {
  return Object.hasOwn(LIMITED_BADGE_ARTWORK, assetId)
    ? LIMITED_BADGE_ARTWORK[assetId as LimitedOccasionId] : undefined
}
