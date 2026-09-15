/**
 * HomePage.tsx from alcohol-health-prototype (f5711b15) supplies the four-card
 * introduction and feature links. Plain CSS replaces its Tailwind dependency.
 * Artwork is served locally; this page never loads personal records or sends
 * browsing data to image/font providers. Topic links use the existing API-backed
 * destinations rather than duplicating the prototype's health claims.
 */
import { useRef, useState } from 'react'
import { applicationHref } from '../app/entryPaths'
import { ReferenceDialog } from '../features/drinks/components/ReferenceDialog'

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

function Chevron() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none" aria-hidden="true">
      <path d="M1 1l5 5-5 5" stroke="#8A8682" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FiTrend() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="12" width="4" height="8" rx="1" stroke="#5B52DC" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="7" width="4" height="13" rx="1" stroke="#5B52DC" strokeWidth="2" strokeLinejoin="round" />
      <rect x="17" y="3" width="4" height="17" rx="1" stroke="#5B52DC" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}


const slides = [
  { title: 'Understand your drinking as you get older', image: 'reflection', label: '', topic: '', tone: 'green',
    alt: 'Woman holding a warm ceramic mug, a quiet moment of reflection' },
  { title: 'How alcohol affects your body differently with age', image: 'ageing', label: 'Alcohol & ageing', topic: 'ALCOHOL_AGEING', tone: 'mint',
    alt: 'Three seniors talking and smiling together' },
  { title: 'What counts as one standard drink', image: 'standard', label: 'Standard drinks', topic: 'STANDARD_DRINK', tone: 'peach',
    alt: 'Pouring a dark drink into a stemmed glass' },
  { title: 'Discover the alcohol content in common drinks', image: 'know', label: 'Know your drink', topic: 'STANDARD_DRINK', tone: 'lilac',
    alt: 'Woman drinking a glass of white wine in natural light' },
] as const

export function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const track = useRef<HTMLDivElement>(null)
const [showAbout, setShowAbout] = useState(false)
  function selectSlide(index: number) {
    const card = track.current?.children[index]
    if (card instanceof HTMLElement && track.current) {
      // Scroll the carousel alone; page focus and the user's vertical position
      // remain stable. No auto-advance competes with reading or keyboard input.
      track.current.scrollTo({ left: card.offsetLeft - track.current.offsetLeft,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      setCurrentSlide(index)
    }
  }
  return (
    <main className="reference-home">
      <header className="reference-page-heading">
        <h1>Home</h1>
        <button className="reference-help" type="button" aria-label="About this app"
         aria-expanded={showAbout} onClick={() => setShowAbout(true)}>?</button>
      </header>
      <div className="home-story-grid" ref={track} aria-label="Explore SipAware" onScroll={() => {
        if (track.current && window.innerWidth < 768) {
          const width = (track.current.firstElementChild as HTMLElement)?.offsetWidth ?? 318
          setCurrentSlide(Math.max(0, Math.min(3, Math.round(track.current.scrollLeft / (width + 12)))))
        }
      }}>
        {slides.map((slide) => (
          <article key={slide.image} className={'home-story home-story--' + slide.tone}>
            <div className="home-story-image">
              <img src={import.meta.env.BASE_URL + 'reference-ui/home-' + slide.image + '.svg'} alt={slide.alt} width="780" height="480" />
              {slide.label && <span>{slide.label}</span>}
            </div>
            <div className="home-story-copy">
              <h2>{slide.title}</h2>
              {slide.topic && <a href={applicationHref('/alcohol-guidelines#' + slide.topic)}>
                Learn more <span aria-hidden="true">→</span>
              </a>}
            </div>
          </article>
        ))}
      </div>
      <div className="home-carousel-controls" aria-label="Choose an introduction card">
        {slides.map((slide, index) => (
          <button key={slide.image} type="button" aria-label={'Slide ' + (index + 1)}
            aria-pressed={index === currentSlide} onClick={() => selectSlide(index)}><span /></button>
        ))}
      </div>
      <section className="home-features" aria-labelledby="home-features-title">
        <h2 id="home-features-title">What you can do here</h2>
        <div className="home-feature-grid">
          <a href={applicationHref('/record')} className="home-feature-card">
            <span className="home-feature-icon"><FiDrink /></span>
            <span><strong>Record your drinks</strong><span>Understand what you’re drinking</span></span>
            <Chevron />
          </a>
          <a href={applicationHref('/alcohol-guidelines')} className="home-feature-card">
            <span className="home-feature-icon home-feature-icon--learn"><FiBook /></span>
            <span><strong>Learn about alcohol</strong><span>Alcohol, ageing and guidelines</span></span>
            <Chevron />
          </a>
          <a href={applicationHref('/trends')} className="home-feature-card">
            <span className="home-feature-icon home-feature-icon--trend"><FiTrend /></span>
            <span><strong>Understand your patterns</strong><span>Review your drinking over time</span></span>
            <Chevron />
          </a>
        </div>
      </section>
      {showAbout && <ReferenceDialog title="About this website"
  onClose={() => setShowAbout(false)}>
  <p>This website helps you understand your drinking as you get older.</p>
  <ul className="reference-about-list">
    <li>Record what you drink</li>
    <li>Learn about standard drinks and Australian guidelines</li>
    <li>Review the drinks saved on this device</li>
  </ul>
  <p>Your drinking records stay in this browser on this device.</p>
  <p>This website provides general health information and does not replace personalised medical advice.</p>
  <button type="button" className="primary-button"
    onClick={() => setShowAbout(false)}>Got it</button>
</ReferenceDialog>}
    </main>
  )
}
