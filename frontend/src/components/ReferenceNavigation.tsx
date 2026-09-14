/**
 * Original Home/Learn/Record/Trends SVGs and Menu shell from the reference App.tsx.
 * Only implemented routes are exposed; navigation never seeds prototype data.
 */
import { applicationPath, applicationHref } from '../app/entryPaths'
function NavHome({ active }: { active: boolean }) {
  const c = active ? '#1A5FCC' : '#687888'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 12L12 3L21 12" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10.5V20a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9.5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NavLearn({ active }: { active: boolean }) {
  const c = active ? '#1A5FCC' : '#687888'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 5C9.2 3.8 6.5 4.2 3 6.2V19.2C6.5 17.2 9.2 17.6 12 18.8C14.8 17.6 17.5 17.2 21 19.2V6.2C17.5 4.2 14.8 3.8 12 5Z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 5V18.8" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function NavRecord({ active }: { active: boolean }) {
  const c = active ? '#1A5FCC' : '#687888'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="2" />
      <path d="M12 8v8M8 12h8" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}


function NavTrends({ active }: { active: boolean }) {
  const c = active ? '#1A5FCC' : '#687888'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="13" width="3.5" height="7" rx="1" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <rect x="9.5" y="9" width="3.5" height="11" rx="1" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <rect x="16" y="4" width="3.5" height="16" rx="1" stroke={c} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}


interface ReferenceNavigationProps {
  path?: string
  onNavigate?: (path: string) => void
}

export function ReferenceNavigation({
  path = applicationPath(),
  onNavigate,
}: ReferenceNavigationProps = {}) {
  const items = [
    { label: 'Home', href: '/', Icon: NavHome },
    {
      label: 'Learn',
      href: '/alcohol-guidelines',
      Icon: NavLearn,
    },
    { label: 'Record', href: '/record', Icon: NavRecord },
    { label: 'Trends', href: '/trends', Icon: NavTrends },
  ]

  return (
    <nav
      className="reference-navigation"
      aria-label="Primary navigation"
    >
      <p className="reference-menu-label">Menu</p>

      <div className="reference-nav-items">
        {items.map(({ label, href, Icon }) => {
          const active = path === href

          return (
            <a
              key={href}
              href={applicationHref(href)}
              aria-current={active ? 'page' : undefined}
              onClick={(event) => {
                const modifiedClick =
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey

                if (modifiedClick || !onNavigate) {
                  return
                }

                event.preventDefault()
                onNavigate(href)
              }}
            >
              <span
                className="reference-nav-icon"
                aria-hidden="true"
              >
                <Icon active={active} />
              </span>

              <span>{label}</span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
