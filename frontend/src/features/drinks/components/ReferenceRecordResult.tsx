/**
 * RecordResultPage.tsx presentation from the pinned reference, shown only after
 * the repository confirms a record. Domain totals/guidelines remain delegated
 * to the existing summary; the prototype's calendar-week math is not imported.
 */
import type { ReactNode } from 'react'
import type { DrinkingRecord } from '../types/drinkingRecord'
import { calculateStandardDrinks, formatStandardDrinks } from '../calculations/standardDrinks'
import { AlcoholInformationTopicLink } from './AlcoholInformationTopicLink'

export function ReferenceResultLinks() {
  return <nav className="reference-result-links" aria-label="Related alcohol information">
    <h3>Learn more</h3>
    <div>
      <AlcoholInformationTopicLink topicCode="ALCOHOL_DRIVING">Alcohol &amp; Driving <span aria-hidden="true">›</span></AlcoholInformationTopicLink>
      <AlcoholInformationTopicLink topicCode="ALCOHOL_AGEING">Alcohol &amp; Ageing <span aria-hidden="true">›</span></AlcoholInformationTopicLink>
      <AlcoholInformationTopicLink topicCode="STANDARD_DRINK">Standard Drinks <span aria-hidden="true">›</span></AlcoholInformationTopicLink>
      <AlcoholInformationTopicLink topicCode="ALCOHOL_GUIDELINES">Australian Alcohol Guidelines <span aria-hidden="true">›</span></AlcoholInformationTopicLink>
    </div>
  </nav>
}

export function ReferenceRecordResult({ record, templateFailed, onDone, children }: {
  record: DrinkingRecord
  templateFailed: boolean
  onDone: () => void
  children: ReactNode
}) {
  return <section className="reference-record-result" aria-labelledby="record-result-title">
    <header className="reference-result-heading">
      <span className="reference-check-badge" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.2 4L19 7" stroke="#15803D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      <div><h1 id="record-result-title" tabIndex={-1}>Drink recorded</h1><p>Here’s what this record means.</p></div>
    </header>
    <p className="reference-sr-only" role="status">Drinking record saved on this device.</p>
    {templateFailed && <p className="form-notice form-notice--error" role="alert">Drinking record saved on this device, but the drink could not be saved to My Drinks. Do not record the same occasion again.</p>}
    <div className="reference-this-drink">
      <p>This drink</p><strong>{formatStandardDrinks(calculateStandardDrinks(record))}</strong>
      <span>standard drinks</span>
      <p>{record.drinkName} · {record.servingVolumeMl * record.amountConsumed} mL recorded</p>
    </div>
    {children}
    <ReferenceResultLinks />
    <button type="button" className="primary-button reference-done" onClick={onDone}>Done</button>
  </section>
}
