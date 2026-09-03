/**
 * Reusable navigation to the API-backed alcohol information topics.
 *
 * The standalone card is used in the page sidebar, while the consumption
 * summary can render the same navigation when tested or used independently.
 */
import { AlcoholInformationTopicLink } from './AlcoholInformationTopicLink'
import { SipAwareIcon } from './SipAwareIcon'

export function AlcoholLearnMore() {
  return (
    <nav
      className="related-information"
      aria-label="Related alcohol information"
    >
      <div className="support-card__heading">
        <span className="support-card__icon support-card__icon--green">
          <SipAwareIcon name="learn" />
        </span>
        <h3>Learn more</h3>
      </div>
      <ul>
        <li>
          <AlcoholInformationTopicLink topicCode="STANDARD_DRINK">
            <span>What is a standard drink?</span>
            <SipAwareIcon name="arrow" />
          </AlcoholInformationTopicLink>
        </li>
        <li>
          <AlcoholInformationTopicLink topicCode="ALCOHOL_GUIDELINES">
            <span>About the Australian guidelines</span>
            <SipAwareIcon name="arrow" />
          </AlcoholInformationTopicLink>
        </li>
        <li>
          <AlcoholInformationTopicLink topicCode="ALCOHOL_AGEING">
            <span>Why does age matter?</span>
            <SipAwareIcon name="arrow" />
          </AlcoholInformationTopicLink>
        </li>
      </ul>
    </nav>
  )
}
