import { useEffect, useState } from 'react'
import { ReferenceDialog } from '../drinks/components/ReferenceDialog'
import type { AwardId, AwardProgress } from './awardRules'
import { loadAwardOverview, type AwardOverview } from './awardOverview'
import './awards.css'

function AwardEmblem({ award }: { award: AwardProgress }) {
  const label = award.id === 'keeping-track' ? '7' : award.id === 'building-a-habit' ? '14'
    : award.id === 'alcohol-free-progress' ? '5' : award.id === 'know-your-patterns' ? '↗' : '✓'
  return <span className={`award-emblem ${award.status === 'earned' ? 'award-emblem--earned' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 100 100" focusable="false"><path d="M29 68 21 95 42 87 50 97 57 72M58 70 66 95 79 87 88 90 76 64" fill="currentColor" opacity=".25" />
      <circle cx="50" cy="44" r="36" fill="currentColor" opacity=".18" />
      <circle cx="50" cy="44" r="29" fill="none" stroke="currentColor" strokeWidth="3" />
      <text x="50" y="54" textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="700">{label}</text>
    </svg>
  </span>
}

function statusLabel(award: AwardProgress) {
  return award.status === 'earned' ? 'Earned' : award.status === 'in-progress' ? 'In progress' : 'Not earned yet'
}

export function AwardsPage({ load = loadAwardOverview }: { load?: () => Promise<AwardOverview> }) {
  const [overview, setOverview] = useState<AwardOverview | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState<AwardId | null>(null)

  useEffect(() => {
    let active = true
    let request = 0
    const refresh = async () => {
      const current = ++request
      try {
        const result = await load()
        if (active && current === request) { setOverview(result); setFailed(false) }
      } catch {
        if (active && current === request) { setOverview(null); setFailed(true) }
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, attempt])

  const selected = overview?.awards.find(award => award.id === selectedId)
  const earnedCount = overview?.awards.filter(award => award.status === 'earned').length ?? 0
  const recent = overview ? [...overview.earned].sort((a, b) => b.earnedAt.localeCompare(a.earnedAt) || a.id.localeCompare(b.id))[0] : undefined
  const recentAward = overview?.awards.find(award => award.id === recent?.id)
  const percentage = overview ? Math.round(earnedCount / overview.awards.length * 100) : 0

  return <main className="awards-page">
    <header><h1>Awards</h1><p>Recognise your progress and celebrate small wins.</p></header>
    {!overview && !failed && <p role="status">Loading your awards…</p>}
    {failed && <div className="awards-error" role="alert"><p>Your awards could not be loaded or saved. Please try again.</p>
      <button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>Try again</button></div>}
    {overview && <>
      <section className="awards-summary" aria-label="Your award progress">
        <div><p className="awards-eyebrow">Your progress</p><h2>{earnedCount} of {overview.awards.length} unlocked</h2></div>
        <span className="awards-percentage" aria-label={`${percentage}% of awards earned`}>{percentage}%</span>
      </section>
      {overview.newlyEarned.length > 0 && <p className="awards-feedback" role="status">New award earned: {overview.newlyEarned.map(row => overview.awards.find(award => award.id === row.id)?.name).join(', ')}.</p>}
      {recentAward && <section className="awards-recent"><h2>Recently unlocked</h2>
        <button className="awards-recent-card" type="button" onClick={() => setSelectedId(recentAward.id)}>
          <AwardEmblem award={recentAward} /><span><span className="awards-eyebrow">Recently unlocked</span><strong>{recentAward.name}</strong><span>{recentAward.condition}</span></span>
        </button></section>}
      <section aria-labelledby="awards-list-title"><h2 id="awards-list-title">Your awards</h2>
        <div className="awards-grid">{overview.awards.map(award => <button key={award.id} className="award-card" type="button" onClick={() => setSelectedId(award.id)} aria-label={`View ${award.name}: ${statusLabel(award)}`}>
          <AwardEmblem award={award} /><h3>{award.name}</h3><p>{award.condition}</p>
          <span className={`award-status award-status--${award.status}`}>{statusLabel(award)}</span>
          {award.target > 1 && <><progress max={award.target} value={award.progress} aria-label={`${award.name} progress`} /><span>{award.progress} of {award.target} days</span></>}
          <span className="award-details-link">View details</span>
        </button>)}</div>
      </section>
      <p className="awards-note">Awards recognise check-ins and awareness, not how much you drink. Your awards stay in this browser. Clearing site data removes them.</p>
    </>}
    {selected && <ReferenceDialog title={selected.name} onClose={() => setSelectedId(null)}>
      <div className="award-detail"><AwardEmblem award={selected} /><p className="award-status">{statusLabel(selected)}</p><p>{selected.condition}</p>
        {selected.target > 1 && <p>{selected.progress} of {selected.target} days</p>}
        {selected.metric === 'creation-days' && <p>Check-ins created on the same day count once, even when you record several past dates. Missing a day does not reset your progress.</p>}
        {selected.metric === 'alcohol-free-days' && <p>Only dates explicitly recorded with no alcohol count. A day with no check-in does not count. Past alcohol-free dates can contribute.</p>}
        {selected.status === 'earned' && <p>Once earned, this award stays earned even if you change or delete your records.</p>}
        {overview?.earned.find(row => row.id === selected.id) && <p>Earned on {new Date(overview.earned.find(row => row.id === selected.id)!.earnedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
        <button type="button" className="primary-button" onClick={() => setSelectedId(null)}>Close</button>
      </div>
    </ReferenceDialog>}
  </main>
}
