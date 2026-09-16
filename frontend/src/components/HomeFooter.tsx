/**
 * Home-only informational footer, reusing the existing accessible modal.
 * It describes the current local-storage/public-catalog boundaries and opens
 * the user's mail app only on an explicit contact click; it submits no data.
 */
import { useRef, useState } from 'react'
import { ReferenceDialog } from '../features/drinks/components/ReferenceDialog'
import './HomeFooter.css'

const sections = ['Contact Us', 'About Us', 'Privacy Policy', 'Terms & Conditions'] as const
type Section = typeof sections[number]
const contactEmail = 'zlin0123@student.monash.edu'

function ContactLink() {
  return <a href={'mailto:' + contactEmail}>{contactEmail}</a>
}

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
          {section === 'Contact Us' && <>
            <p>Have a question, feedback or a problem with SipAware? Contact the project team:</p>
            <p><ContactLink /></p>
            <p>This opens your email app. Please avoid sending drinking records or other sensitive health information.</p>
          </>}
          {section === 'About Us' && <>
            <p>SipAware is a student project developed by FIT5120 Team 20 at Monash University.</p>
            <p>We help people understand standard drinks, record their drinking and review their patterns over time.</p>
            <p>The website offers educational information. It does not provide a diagnosis or replace advice from a healthcare professional.</p>
          </>}
          {section === 'Privacy Policy' && <>
            <p>Your drinking records and My Drinks are stored in this browser on this device. The app does not send these personal records to its cloud product database.</p>
            <h3>Your choices</h3>
            <p>You can review, edit and delete records in History, and manage saved drinks in My Drinks. Clearing this website’s browser data removes locally saved records. There is no account-based backup or automatic sync to another device.</p>
            <p>PDF reports are generated on your device. You choose whether to download or share them.</p>
            <h3>Online requests and contact</h3>
            <p>Product searches and barcode lookups send the search text or barcode to our API to find public product information. Camera images used for barcode decoding are processed in the browser.</p>
            <p>Hosting and service providers may process technical request information, such as IP addresses, to deliver the website. External source links and your email provider have their own privacy practices.</p>
            <p>If you email us, we receive your email address and the content you send to respond to your enquiry. For privacy questions or requests about an email you sent, contact <ContactLink />.</p>
          </>}
          {section === 'Terms & Conditions' && <>
            <p>SipAware is an educational tool for recording and reviewing alcohol consumption. Its information and estimates are not a medical diagnosis or personalised advice.</p>
            <p>Check the drink name, serving volume, alcohol percentage, amount and consumption time before saving. Product information may be incomplete or out of date, and your report reflects only the records you enter.</p>
            <p>Records depend on this browser’s local storage. Clearing browser data or changing devices may make them unavailable. Download a report if you need a copy.</p>
            <p>Use the website lawfully and avoid disrupting its services. Linked sources are operated by their respective providers.</p>
            <p>For questions about using SipAware, contact <ContactLink />.</p>
          </>}
        </div>
        <button type="button" className="primary-button" onClick={close}>Close</button>
      </ReferenceDialog>}
    </>
  )
}
