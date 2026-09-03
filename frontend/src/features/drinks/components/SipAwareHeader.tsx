import { SipAwareBrandMark } from './SipAwareIcon'

export function SipAwareHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-brand">
          <SipAwareBrandMark />
          <span className="site-brand__name">
            SipAware <b>AU</b>
          </span>
        </div>
      </div>
    </header>
  )
}
