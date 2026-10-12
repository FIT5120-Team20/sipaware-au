import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { ReferenceBackBar } from '../drinks/components/ReferenceBackBar'
import { applicationHref } from '../../app/entryPaths'
import { AWARD_CATEGORIES, type AwardCategory, type AwardId } from './awardDefinitions'
import type { AwardPresentation } from './awardPresentation'
import { loadAwardOverview, type AwardOverview } from './awardOverview'
import { AWARDS_CHANGED_EVENT, publishAwardResult } from './awardFeedbackEvents'
import { AwardMedal } from './AwardMedal'
import { awardDetailDescription, awardStatusLabel, compactAwardProgress } from './awardDisplay'
import { awardsViewHref, useAwardsNavigation, type AwardsCollectionView } from './useAwardsNavigation'
import './awards.css'

function followLink(event: MouseEvent<HTMLAnchorElement>, action: () => void) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  action()
}

function Chevron() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

function MedalPreviews({ awards }: { awards: readonly AwardPresentation[] }) {
  if (awards.length === 0) return null
  return <span className="award-medal-previews" aria-hidden="true">
    {awards.map(award => <AwardMedal key={award.id} award={award} size="preview" decorative />)}
  </span>
}

function GoalProgress({ award, compact = false }: { award: AwardPresentation; compact?: boolean }) {
  const goals = award.goals.length > 0 ? award.goals : compact ? [{
    key: 'check-in-days', label: 'Check-ins', current: award.progress, target: award.target,
  }] : []
  if (award.status === 'earned' || goals.length === 0) return null
  return <ul className={`award-goals${compact ? ' award-goals--compact' : ''}`}>
    {goals.map(goal => <li key={goal.key}>
      <div className={compact && award.eligibility !== 'monthly' ? 'award-goal-count' : undefined}>
        {(!compact || award.eligibility === 'monthly') && <span>{compact
          ? goal.key === 'alcohol-free-days' ? 'Alcohol-free' : 'Check-ins' : goal.label}</span>}
        <strong>{compact ? Math.min(goal.current, goal.target) : goal.current} / {goal.target}</strong>
      </div>
      <progress max={goal.target} value={Math.min(goal.current, goal.target)}
        aria-label={`${award.name}: ${goal.label}`} />
    </li>)}
  </ul>
}

function AwardGrid({ awards, collection, openAward }: {
  awards: readonly AwardPresentation[]; collection: Exclude<AwardsCollectionView, null>
  openAward: (id: AwardId) => void
}) {
  return <ul className={`award-collection-grid${collection === 'getting-started' ? ' award-collection-grid--getting-started' : ''}`}>
    {awards.map(award => <li key={award.id}>
      <a className="award-collection-item" href={awardsViewHref(collection, award.id)}
        aria-label={`View ${award.name}: ${awardStatusLabel(award)}`}
        onClick={event => followLink(event, () => openAward(award.id))}>
        <AwardMedal award={award} decorative />
        <span className="award-item-name">{award.name}</span>
        {award.status === 'earned'
          ? <span className="award-item-status award-item-status--earned">{awardStatusLabel(award)}</span>
          : <GoalProgress award={award} compact />}
      </a>
    </li>)}
  </ul>
}

function AwardDetail({ award }: { award: AwardPresentation }) {
  const earned = award.status === 'earned'
  const monthly = award.eligibility === 'monthly'
  const deadline = monthly && award.year && award.month
    ? new Date(award.year, award.month, 0).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : undefined
  return <article className="award-detail" aria-labelledby="award-detail-title">
    <div className="award-detail-artwork"><AwardMedal award={award} size="detail" /></div>
    <h1 id="award-detail-title">{award.name}</h1>
    <p className={`award-detail-status${earned ? ' award-detail-status--earned' : ''}`}>{awardStatusLabel(award)}</p>
    <p className="award-detail-description">{awardDetailDescription(award)}</p>
    {award.significance && <p className="award-detail-significance">{award.significance}</p>}
    {!earned && <GoalProgress award={award} />}
    {!earned && award.eligibility === 'consecutive-dates' &&
      <p className="award-detail-note">Drinking and confirmed alcohol-free dates both count. Historical backfilling is allowed.</p>}
    {!earned && monthly && <p className="award-detail-note">
      Both the recorded date and original creation date must be in the challenge month. Alcohol-free dates must have no drinking records.
    </p>}
    {!earned && deadline && <p className="award-detail-note">Complete by {deadline}, in your local time.</p>}
    {!earned && award.eligibility === 'trends-visit' && award.progress >= award.target &&
      <a className="award-detail-trends secondary-button" href={applicationHref('/trends')}>Open Trends</a>}
    {award.id === 'building-a-habit' &&
      <p className="award-detail-note">21 days is a milestone, not a claim about how long it takes to form a habit.</p>}
  </article>
}

function CategoryCard({ category, featured, previews, open }: {
  category: AwardCategory; featured: AwardPresentation; previews: readonly AwardPresentation[]
  open: (collection: AwardsCollectionView, awardId?: AwardId) => void
}) {
  const name = AWARD_CATEGORIES.find(item => item.id === category)!.name
  return <a className={`award-category-card award-category-card--${category}`}
    href={awardsViewHref(category)} onClick={event => followLink(event, () => open(category))}>
    <h2>{name}</h2>
    <div className="award-category-showcase">
      <div className="award-category-feature"><AwardMedal award={featured} size="featured" decorative /></div>
      <div className="award-category-caption">
        <span className="award-category-feature-name">{featured.name}</span>
        {featured.status === 'earned' && <span className="award-category-feature-date">{awardStatusLabel(featured)}</span>}
      </div>
    </div>
    <div className="award-category-footer">
      <MedalPreviews awards={previews} />
      <span className="award-view-all">View all <Chevron /></span>
    </div>
  </a>
}

function AwardsHome({ overview, open }: {
  overview: AwardOverview; open: (collection: AwardsCollectionView, awardId?: AwardId) => void
}) {
  const progressing = overview.keepGoing
  const featuredProgress = progressing[0]
  const consistency = overview.categories.consistency
  const featuredConsistency = [...consistency].reverse().find(award => award.status === 'earned') ?? consistency[0]
  const gettingStarted = overview.categories['getting-started']
  const featuredGettingStarted = gettingStarted.filter(award => award.status === 'earned')
    .sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '') || a.order - b.order)[0] ?? gettingStarted[0]
  const monthly = overview.currentMonthlyAward

  return <div className="awards-home-content">
    <a className="award-keep-going-card" href={awardsViewHref('keep-going')}
      onClick={event => followLink(event, () => open('keep-going'))}>
      <div className="award-keep-going-main">
        {featuredProgress && <AwardMedal award={featuredProgress} size="featured" decorative />}
        <div className="award-keep-going-copy">
          <h2>Keep going</h2>
          {featuredProgress ? <>
            <span className="award-keep-going-name">{featuredProgress.name}</span>
            <span className="award-keep-going-progress">{compactAwardProgress(featuredProgress)}</span>
          </> : <span className="award-keep-going-progress">No awards in progress. Your next check-in is a good place to start.</span>}
        </div>
      </div>
      <div className="award-keep-going-trailing">
        <MedalPreviews awards={progressing.slice(1, 4)} />
        <span className="award-view-all">View all <Chevron /></span>
      </div>
    </a>
    <div className="award-category-grid">
      <CategoryCard category="consistency" featured={featuredConsistency}
        previews={consistency.filter(award => award.id !== featuredConsistency.id)} open={open} />
      <CategoryCard category="getting-started" featured={featuredGettingStarted}
        previews={gettingStarted.filter(award => award.id !== featuredGettingStarted.id)} open={open} />
      <CategoryCard category="challenges" featured={monthly}
        previews={overview.categories.challenges.filter(award => award.status === 'earned' && award.id !== monthly.id).slice(0, 3)} open={open} />
    </div>
  </div>
}

export function AwardsPage({ load = loadAwardOverview }: { load?: () => Promise<AwardOverview> }) {
  const root = useRef<HTMLElement>(null)
  const { view, open, back } = useAwardsNavigation(root)
  const [overview, setOverview] = useState<AwardOverview | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    let request = 0
    const refresh = async () => {
      const current = ++request
      try {
        const result = await load()
        if (active && current === request) {
          setOverview(result); setFailed(false)
          if (result.newlyEarned.length > 0) publishAwardResult(result)
        }
      } catch {
        if (active && current === request) { setOverview(null); setFailed(true) }
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    window.addEventListener('focus', refresh)
    window.addEventListener(AWARDS_CHANGED_EVENT, refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.removeEventListener(AWARDS_CHANGED_EVENT, refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, attempt])

  const category = AWARD_CATEGORIES.find(item => item.id === view.collection)
  const keepGoing = view.collection === 'keep-going'
  const selected = overview?.awards.find(award => award.id === view.awardId)
  const collectionName = keepGoing ? 'Keep going' : category?.name
  const backCollection = view.awardId ? view.collection : null
  const backLabel = `Back to ${view.awardId && collectionName ? collectionName : 'Awards'}`
  const subpage = Boolean(view.collection || view.awardId)
  const currentMonthlyId = overview?.currentMonthlyAward.id
  const earnedChallenges = overview?.categories.challenges.filter(award =>
    award.status === 'earned' && award.id !== currentMonthlyId) ?? []

  return <main ref={root} className={`awards-page${subpage ? ' awards-page--subpage' : ''}${view.awardId ? ' awards-page--detail' : ''}`}
    data-navigation-scroll-ready={overview || failed ? 'true' : 'false'}>
    {subpage && <ReferenceBackBar label={backLabel} href={awardsViewHref(backCollection)} onClick={() => back(backCollection)} />}
    {!view.awardId && <header><h1>{collectionName ?? 'Awards'}</h1>
      {keepGoing && <p>Awards you're working towards.</p>}
    </header>}
    {view.awardId && !overview && <header><h1>Award details</h1></header>}
    {!overview && !failed && <p className="awards-load-message" role="status">Loading your awards…</p>}
    {failed && <div className="awards-error" role="alert"><p>Your awards could not be loaded or saved. Please try again.</p>
      <button type="button" className="secondary-button" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>Try again</button></div>}
    {overview && (view.awardId ? selected ? <AwardDetail key={selected.id} award={selected} />
      : <div className="awards-unavailable"><h1>Award not available</h1><p>This award isn't in your current collection.</p></div>
      : keepGoing ? <div className="awards-collection-content">
        {overview.keepGoing.length > 0
          ? <AwardGrid awards={overview.keepGoing} collection="keep-going" openAward={id => open('keep-going', id)} />
          : <p className="awards-empty">No awards in progress. Explore your collection or record your next check-in.</p>}
      </div> : category ? <div className="awards-collection-content">
        {category.id === 'challenges' ? <>
          <section aria-labelledby="award-current-month-title">
            <h2 id="award-current-month-title">Current Monthly Challenge</h2>
            <AwardGrid awards={[overview.currentMonthlyAward]} collection="challenges" openAward={id => open('challenges', id)} />
          </section>
          {earnedChallenges.length > 0 && <section aria-labelledby="awards-earned-title">
            <h2 id="awards-earned-title">Awards Earned</h2>
            <AwardGrid awards={earnedChallenges} collection="challenges" openAward={id => open('challenges', id)} />
          </section>}
        </> : <AwardGrid awards={overview.categories[category.id]} collection={category.id} openAward={id => open(category.id, id)} />}
      </div> : <AwardsHome overview={overview} open={open} />)}
  </main>
}
