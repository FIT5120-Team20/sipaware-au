/**
 * Home-only informational footer, reusing the existing accessible modal.
 * It describes the current local-storage/public-catalog boundaries and terms.
 */
import { useRef, useState } from 'react'
import { ReferenceDialog } from '../features/drinks/components/ReferenceDialog'
import './HomeFooter.css'

const sections = ['Privacy Policy', 'Terms & Conditions'] as const
type Section = typeof sections[number]

export function HomeFooter() {
  const [section, setSection] = useState<Section | null>(null)
  const opener = useRef<HTMLButtonElement | null>(null)
  function close() {
    setSection(null)
    // React removes the native dialog on close; restore the initiating control
    // after that commit so keyboard users can continue through footer links.
    window.requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }))
  }
  return (
    <>
      <footer className="home-footer" aria-label="SipAware information">
        <p>© {new Date().getFullYear()} SipAware</p>
        <nav aria-label="Website information">
          {sections.map(item => <button key={item} type="button" aria-haspopup="dialog"
            onClick={event => { opener.current = event.currentTarget; setSection(item) }}>{item}</button>)}
        </nav>
      </footer>
      {section && <ReferenceDialog title={section} onClose={close}>
        <div className="home-footer-information">
          {section === 'Privacy Policy' && <>
            <p>Your drinking records and My Drinks are stored in this browser on this device. The app does not send these personal records to its cloud product database.</p>
            <h3>Your choices</h3>
            <p>You can review, edit and delete records in History, and manage saved drinks in My Drinks. Clearing this website’s browser data removes locally saved records. There is no account-based backup or automatic sync to another device.</p>
            <p>PDF reports are generated on your device. You choose whether to download or share them.</p>
            <h3>Online requests</h3>
            <p>Product searches and barcode lookups send the search text or barcode to our API to find public product information. Camera images used for barcode decoding are processed in the browser.</p>
            <p>Hosting and service providers may process technical request information, such as IP addresses, to deliver the website. External source links have their own privacy practices.</p>
          </>}
          {section === 'Terms & Conditions' && <>
            <p>SipAware is an educational tool for recording and reviewing alcohol consumption. Its information and estimates are not a medical diagnosis or personalised advice.</p>
            <p>Check the drink name, serving volume, alcohol percentage, amount and consumption time before saving. Product information may be incomplete or out of date, and your report reflects only the records you enter.</p>
            <p>Records depend on this browser’s local storage. Clearing browser data or changing devices may make them unavailable. Download a report if you need a copy.</p>
            <p>Use the website lawfully and avoid disrupting its services. Linked sources are operated by their respective providers.</p>
          </>}
        </div>
        <button type="button" className="primary-button" onClick={close}>Close</button>
      </ReferenceDialog>}
    </>
  )
}
