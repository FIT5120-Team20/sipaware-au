type ReferenceBackBarProps = {
  label: string
  href?: string
  onClick?: () => void
}

function BackArrow() {
  return <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true">
    <path d="M7.5 1.5L1.5 7.5L7.5 13.5" stroke="#1A5FCC" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}

export function ReferenceBackBar({ label, href, onClick }: ReferenceBackBarProps) {
  const content = <><BackArrow /><span>{label}</span></>

  return <div className="prototype-sticky-back">
    {href
      ? <a className="prototype-back" href={href}>{content}</a>
      : <button type="button" className="prototype-back" onClick={onClick}>{content}</button>}
  </div>
}