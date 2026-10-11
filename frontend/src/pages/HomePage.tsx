import { HomeFooter } from '../components/HomeFooter'
import { applicationHref } from '../app/entryPaths'
import { ReminderSettings } from '../features/reminders/ReminderSettings'
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
  { title: 'Set a reminder', subtitle: 'Set a time for your daily check-in', icon: 'reminder', path: null },
  { title: 'Earn awards', subtitle: 'Celebrate your progress and milestones', icon: 'awards', path: '/awards' },
] as const

function FeatureContent({ feature }: { feature: typeof features[number] }) {
  const OriginalIcon = feature.icon === 'record' ? FiDrink : feature.icon === 'learn' ? FiBook : feature.icon === 'trends' ? FiTrend : null
  return <>
    <span className={'home-feature-icon home-feature-icon--' + (feature.icon === 'trends' ? 'trend' : feature.icon)} aria-hidden="true">
      {OriginalIcon ? <OriginalIcon /> : <img src={import.meta.env.BASE_URL + 'reference-ui/home-' + feature.icon + '.svg'} alt="" width="22" height="22" />}
    </span>
    <span className="home-feature-copy"><strong>{feature.title}</strong><span>{feature.subtitle}</span></span>
    <Chevron />
  </>
}

export function HomePage() {
  return <main className="reference-home home-page">
    <header className="home-hero">
      <img src={import.meta.env.BASE_URL + 'reference-ui/home-hero-lime.png'} alt="" width="1680" height="936" fetchPriority="high" />
      <h1>SipAware</h1>
    </header>
    <div className="home-main-content">
      <section className="home-features" aria-labelledby="home-features-title">
        <h2 id="home-features-title">What you can do here</h2>
        <div className="home-feature-grid">
          {features.map(feature => feature.path === null
            ? <ReminderSettings key={feature.icon} renderTrigger={open => (
              <button type="button" className="home-feature-card" aria-haspopup="dialog" onClick={open}>
                <FeatureContent feature={feature} />
              </button>
            )} />
            : <a key={feature.icon} href={applicationHref(feature.path)} className="home-feature-card">
              <FeatureContent feature={feature} />
            </a>)}
        </div>
      </section>
      <HomeFooter />
    </div>
  </main>
}
