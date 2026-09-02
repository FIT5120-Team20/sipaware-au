/**
 * Presents general preventive driving guidance after the parent confirms a
 * browser-local drinking record for today.
 *
 * This component accepts no personal or calculated input and owns no trigger,
 * BAC/clearance logic, network request, or persistence. Detailed sourced
 * information and working navigation remain the responsibility of US2.3.
 */
import '../alcoholConsumption.css'

export function DrivingSafetyGuidance() {
  return (
    <section
      className='driving-safety-card'
      aria-labelledby='driving-safety-title'
    >
      <h2 id='driving-safety-title'>Driving safety</h2>
      <p className='driving-safety-lead'>Avoid drinking and driving.</p>
      <p>Alcohol can impair driving and increase crash risk.</p>
      <p>
        Being below an alcohol guideline does not mean it is safe to drive.
      </p>
      <p>
        SipAware does not estimate BAC or tell you when it is safe to drive.
      </p>
    </section>
  )
}
