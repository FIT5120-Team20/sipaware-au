/**
 * REUSE: LearnPage.tsx hub anatomy and original topic SVGs at f5711b15.
 * ADAPT: cards link to validated API topic codes. The legal topic replaces the
 * prototype-only health topic; public content/provenance still comes from I1.
 */
import type { AlcoholInformationTopicDto } from '../types/alcoholInformation'
function IcoGlass({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 3H18L16.5 19H7.5L6 3Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 19H14M12 14V19" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IcoDoc({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="2" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IcoPerson({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" />
      <path d="M5 21v-1a7 7 0 0 1 14 0v1" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M18 5h2.5M19.25 3.75v2.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IcoPill({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <g transform="rotate(-45 12 12)">
        <rect x="5" y="8.5" width="14" height="7" rx="3.5" stroke={color} strokeWidth="2" fill="none" />
        <line x1="12" y1="8.5" x2="12" y2="15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      </g>
    </svg>
  )
}

function IcoCar({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M7 17H4a1 1 0 0 1-1-1v-4l2-6h14l2 6v4a1 1 0 0 1-1 1h-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="17" r="2" stroke={color} strokeWidth="2" />
      <circle cx="16.5" cy="17" r="2" stroke={color} strokeWidth="2" />
      <path d="M3 12h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ── UI chrome icons ────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1l5 5-5 5" stroke="#8A8682" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ShieldCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z" stroke="#1A5FCC" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="#1A5FCC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


const topicPresentation = {
  STANDARD_DRINK: { title: 'Standard Drinks', subtitle: 'Understand what one standard drink means.', bg: '#DDEEFF', color: '#1B63D4', Icon: IcoGlass },
  ALCOHOL_GUIDELINES: { title: 'Australian Alcohol Guidelines', subtitle: 'Know the recommended limits to reduce risk.', bg: '#D8EFFE', color: '#0881CC', Icon: IcoDoc },
  ALCOHOL_AGEING: { title: 'Alcohol & Ageing', subtitle: 'Why alcohol may affect you differently as you age.', bg: '#ECEAFF', color: '#5B52DC', Icon: IcoPerson },
  ALCOHOL_MEDICINES: { title: 'Alcohol & Medicines', subtitle: 'Learn why extra care may be needed with medicines.', bg: '#DDEEFF', color: '#1B63D4', Icon: IcoPill },
  ALCOHOL_DRIVING: { title: 'Alcohol & Driving', subtitle: 'Alcohol and driving — what you need to know.', bg: '#ECEAFF', color: '#5B52DC', Icon: IcoCar },
  ALCOHOL_LEGAL: { title: 'Alcohol & Legal Information', subtitle: 'Explore Australian alcohol laws and trusted sources.', bg: '#D8F2FB', color: '#0A8EBA', Icon: ShieldCheck },
}
export function ReferenceLearnHub({ topics }: { topics: readonly AlcoholInformationTopicDto[] }) {
  const ordered = Object.keys(topicPresentation).flatMap(code => topics.filter(topic => topic.topicCode === code))
  const hasAgeing = topics.some(topic => topic.topicCode === 'ALCOHOL_AGEING')
  return <>
    <div className="prototype-learn-grid">
      {hasAgeing && <a className="prototype-learn-feature" href="#ALCOHOL_AGEING">
        <div className="prototype-learn-image">
          <img src="/reference-ui/home-ageing.svg" alt="Three seniors talking and smiling" draggable={false} />
          <span>Featured</span>
        </div>
        <div className="prototype-learn-feature-copy">
          <p>Alcohol &amp; Ageing</p>
          <h2>As you get older, alcohol may affect you differently.</h2>
          <span>Learn more →</span>
        </div>
      </a>}
      <nav className="prototype-learn-topics" aria-label="Alcohol information topics">
        <h2>Explore Topics</h2>
        <ul>{ordered.map(topic => {
          const presentation = topicPresentation[topic.topicCode]
          const Icon = presentation.Icon
          return <li key={topic.topicCode}>
            <a href={'#' + topic.topicCode} aria-label={topic.displayName}>
              <span className="prototype-topic-icon" data-topic-icon={topic.topicCode} aria-hidden="true" style={{ background: presentation.bg }}><Icon color={presentation.color} /></span>
              <span className="prototype-topic-copy"><strong>{presentation.title}</strong><span>{presentation.subtitle}</span></span>
              <span aria-hidden="true"><ChevronRight /></span>
            </a>
          </li>
        })}</ul>
      </nav>
    </div>
    <div className="prototype-learn-trust"><span aria-hidden="true"><ShieldCheck /></span><p>All information on this site comes from trusted Australian health sources.</p></div>
  </>
}
