import { useId } from 'react'
import type { AwardPresentation } from './awardPresentation'

type MedalSize = 'preview' | 'collection' | 'featured' | 'detail' | 'notice'
type Palette = { accent: string; dark: string; light: string }
const MONTH_COLOURS = ['#547bc3', '#a7618f', '#509476', '#459aab', '#758c42', '#b38939',
  '#b77646', '#9a739f', '#63877e', '#bd8050', '#6b79b1', '#a85e73']

function medalPalette(award: AwardPresentation): Palette {
  if (award.eligibility === 'monthly') {
    return { accent: MONTH_COLOURS[(award.medal.month ?? 1) - 1], dark: '#594735', light: '#fff4df' }
  }
  if (award.id === 'first-step') return { accent: '#499584', dark: '#276759', light: '#e2f4ed' }
  if (award.id === 'know-your-patterns') return { accent: '#5487d5', dark: '#28529d', light: '#e5efff' }
  if (award.eligibility === 'consecutive-dates') {
    return award.target === 7 ? { accent: '#547dcb', dark: '#2b5194', light: '#e4edff' }
      : award.target === 14 ? { accent: '#9678b6', dark: '#694489', light: '#f0e8fa' }
        : { accent: '#bd9145', dark: '#806022', light: '#fff1d5' }
  }
  if (award.medal.assetId === 'world-heart-day') return { accent: '#cb7281', dark: '#903e50', light: '#ffe6eb' }
  if (award.medal.assetId === 'world-mental-health-day') return { accent: '#9a7bb9', dark: '#694e85', light: '#eee6f7' }
  return { accent: '#59a18f', dark: '#2e7260', light: '#e3f5ec' }
}

function MedalSymbol({ award }: { award: AwardPresentation }) {
  if (award.eligibility === 'monthly') return <>
    <text x="64" y="81" textAnchor="middle" fontSize="35" fontWeight="700">{award.medal.month}</text>
    <path d="M46 90h36" stroke="currentColor" opacity=".4" />
    <text x="64" y="107" textAnchor="middle" fontSize="15" fontWeight="600" letterSpacing="1">{award.medal.year}</text>
  </>
  if (award.eligibility === 'consecutive-dates') return <>
    <path d="m64 47 2 5 6 .5-4 3.5 1 5-5-3-5 3 1-5-4-3.5 6-.5Z" fill="currentColor" />
    <text x="64" y="93" textAnchor="middle" fontSize="34" fontWeight="700">{award.target}</text>
    <path d="M48 104h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </>
  if (award.id === 'first-step') return <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M49 104V72c0-8 6-14 14-14s14 6 14 14v21c0 7-5 11-11 11H49Z" />
    <path d="M62 76c0-14 10-21 25-21-1 14-10 21-25 21Zm0 0 14-12M45 60v8m-4-4h8" />
    <path d="m57 89 6 6 13-15" />
  </g>
  if (award.id === 'know-your-patterns') return <g fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M43 102V90m14 12V79m14 23V85m14 17V66M42 78l16-13 13 5 15-17m-9 0h9v9" />
  </g>
  if (award.medal.assetId === 'world-heart-day') return <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M64 105 42 83c-16-18 7-37 22-20 15-17 38 2 22 20Z" fill="currentColor" fillOpacity=".1" />
    <path d="M41 81h13l5-12 8 23 6-11h14" />
  </g>
  if (award.medal.assetId === 'world-mental-health-day') return <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M51 101V87c-19-17-3-40 14-35 21-2 28 17 17 31l-3 12H65v8M58 84c0-17 8-22 19-22-1 13-7 21-19 22Zm0 0 10-11" />
    <path d="M44 55v-5m-4 4-4-3m52 4 5-3" />
  </g>
  return <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <circle cx="64" cy="82" r="25" /><ellipse cx="64" cy="82" rx="12" ry="25" />
    <path d="M39 82h50M43 69h42M43 95h42" />
    <circle cx="84" cy="59" r="12" fill="#fff" /><path d="M84 53v12m-6-6h12" />
  </g>
}

/** Replaceable static artwork, shared by previews, collections, details and notices. */
export function AwardMedal({ award, size = 'collection', decorative = false }: {
  award: AwardPresentation; size?: MedalSize; decorative?: boolean
}) {
  const gradientId = useId()
  const palette = medalPalette(award)
  const monthly = award.eligibility === 'monthly'
  const shape = monthly ? 'M64 35 94 44 105 69 99 103 64 124 29 103 23 69 34 44Z'
    : award.eligibility === 'consecutive-dates' && award.target === 14
      ? 'M64 35 103 57 103 101 64 124 25 101 25 57Z'
      : award.eligibility === 'consecutive-dates' && award.target === 21
        ? 'M64 34 76 40 90 40 97 52 108 61 105 76 108 91 97 100 90 113 76 113 64 125 52 113 38 113 31 100 20 91 23 76 20 61 31 52 38 40 52 40Z'
        : undefined
  const label = `${award.name} medal, ${award.status === 'earned' ? 'earned' : 'not yet earned'}`
  return <span className={`award-medal award-medal--${size}${award.medal.state === 'desaturated' ? ' award-medal--unearned' : ''}`}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
    {award.medal.source ? <img src={award.medal.source} alt="" /> :
      <svg viewBox="0 0 128 144" aria-hidden="true" focusable="false" style={{ color: palette.dark }}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={palette.light} /><stop offset="1" stopColor={palette.accent} />
        </linearGradient></defs>
        <path d="m40 13 21-6 21 42-18 14Z" fill={palette.accent} />
        <path d="m88 13-21-6-21 42 18 14Z" fill={palette.accent} />
        <path d="m48 12 20 42m12-42L60 54" stroke={palette.light} strokeWidth="5" />
        {shape ? <path d={shape} fill={`url(#${gradientId})`} stroke={palette.accent} strokeWidth="3" />
          : <circle cx="64" cy="79" r="45" fill={`url(#${gradientId})`} stroke={palette.accent} strokeWidth="3" />}
        <circle cx="64" cy="79" r="35" fill={palette.light} stroke={palette.accent} strokeWidth="1.5" />
        <MedalSymbol award={award} />
        {award.eligibility === 'limited-edition' && <text x="64" y="136" textAnchor="middle" fill={palette.dark} fontSize="11" fontWeight="600">{award.medal.year}</text>}
      </svg>}
  </span>
}
