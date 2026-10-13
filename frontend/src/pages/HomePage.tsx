import { HomeFooter } from '../components/HomeFooter'
import { applicationHref } from '../app/entryPaths'
import { homeReminderPresentation, useRecordingReminder } from '../features/reminders/recordingReminderState'
import './homePage.css'

function FiDrink() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 3H18L16.5 19H7.5L6 3Z" stroke="#1B63D4" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 19H14M12 14V19" stroke="#1B63D4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function FiBook() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5C9.2 3.8 6.5 4.2 3 6.2V19.2C6.5 17.2 9.2 17.6 12 18.8C14.8 17.6 17.5 17.2 21 19.2V6.2C17.5 4.2 14.8 3.8 12 5Z" stroke="#0881CC" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 5V18.8" stroke="#0881CC" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function FiTrend() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="12" width="4" height="8" rx="1" stroke="#5B52DC" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="7" width="4" height="13" rx="1" stroke="#5B52DC" strokeWidth="2" strokeLinejoin="round" />
      <rect x="17" y="3" width="4" height="17" rx="1" stroke="#5B52DC" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function Chevron() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true">
      <path d="M1 1l5 5-5 5" stroke="#8A8682" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const features = [
  { title: 'Record your drinks', subtitle: 'Understand what you’re drinking', icon: 'record', path: '/record' },
  { title: 'Learn about alcohol', subtitle: 'Alcohol, ageing and guidelines', icon: 'learn', path: '/alcohol-guidelines' },
  { title: 'Understand your patterns', subtitle: 'Review your drinking over time', icon: 'trends', path: '/trends' },
  { title: 'Set a reminder', subtitle: 'Set a time for your daily check-in', icon: 'reminder', path: '/recording-reminder' },
  { title: 'Earn awards', subtitle: 'Celebrate your progress and milestones', icon: 'awards', path: '/awards' },
] as const

function FeatureContent({ feature, reminder }: { feature: typeof features[number]; reminder: ReturnType<typeof homeReminderPresentation> }) {
  const OriginalIcon = feature.icon === 'record' ? FiDrink : feature.icon === 'learn' ? FiBook : feature.icon === 'trends' ? FiTrend : null
  return <>
    <span className={'home-feature-icon home-feature-icon--' + (feature.icon === 'trends' ? 'trend' : feature.icon)} aria-hidden="true">
      {OriginalIcon ? <OriginalIcon /> : feature.icon === 'reminder' && reminder.ringing
        ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A5FCC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M2 8a10 10 0 0 1 2-5M22 8a10 10 0 0 0-2-5" />
        </svg>
        : <img src={import.meta.env.BASE_URL + 'reference-ui/home-' + feature.icon + '.svg'} alt="" width="22" height="22" />}
    </span>
    <span className="home-feature-copy"><strong>{feature.title}</strong><span>{feature.icon === 'reminder' ? reminder.subtitle : feature.subtitle}</span></span>
    <Chevron />
  </>
}

export function HomePage({ onNavigate }: { onNavigate?: (path: string) => void } = {}) {
  const reminder = homeReminderPresentation(useRecordingReminder())
  return <main className="reference-home home-page">
    <header className="home-hero">
      <img src={import.meta.env.BASE_URL + 'reference-ui/home-hero-lime.png'} alt="" width="1680" height="936" fetchPriority="high" />
      <h1 aria-label="SipAware">
        <a href={applicationHref('/')} className="home-brand" aria-label="SipAware Home"
          onClick={event => {
            if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onNavigate('/')
          }}>
          <img src={import.meta.env.BASE_URL + 'branding/sipaware-logo.png'} alt="SipAware" width="1400" height="414" />
        </a>
      </h1>
    </header>
    <div className="home-main-content">
      <section className="home-features" aria-labelledby="home-features-title">
        <h2 id="home-features-title">What you can do here</h2>
        <div className="home-feature-grid">
          {features.map(feature => <a key={feature.icon} href={applicationHref(feature.path)} className="home-feature-card"
            onClick={event => {
              if (feature.icon !== 'reminder' || !onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              onNavigate(feature.path)
            }}>
            <FeatureContent feature={feature} reminder={reminder} />
          </a>)}
        </div>
      </section>
      <HomeFooter />
    </div>
  </main>
}
