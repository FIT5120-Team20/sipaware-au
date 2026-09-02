/**
 * Semantic presentation for one API-backed topic and its source provenance.
 */
import type { AlcoholInformationTopicDto } from '../types/alcoholInformation'

interface AlcoholInformationSectionProps {
  topic: AlcoholInformationTopicDto
}

const verifiedDateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatVerifiedDate(value: string): string {
  return verifiedDateFormatter.format(new Date(value + 'T00:00:00.000Z'))
}

export function AlcoholInformationSection({
  topic,
}: AlcoholInformationSectionProps) {
  const headingId = 'alcohol-information-heading-' + topic.topicCode

  return (
    <section
      className='alcohol-information-section'
      id={topic.topicCode}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} tabIndex={-1}>
        {topic.displayName}
      </h2>

      {topic.content.map((content) => (
        <article
          className='alcohol-information-content'
          key={content.id}
        >
          <h3>{content.title}</h3>
          <p>{content.bodyText}</p>
          <p className='alcohol-information-verified'>
            Information last verified{' '}
            <time dateTime={content.lastVerified}>
              {formatVerifiedDate(content.lastVerified)}
            </time>
          </p>

          <div className='alcohol-information-sources'>
            <h4>Sources</h4>
            <ul>
              {content.sources.map((source) => (
                <li key={source.id}>
                  <span className='alcohol-information-source-role'>
                    {source.role === 'PRIMARY'
                      ? 'Primary source'
                      : 'Supporting source'}
                  </span>
                  <a
                    href={source.url}
                    target='_blank'
                    rel='noreferrer'
                  >
                    {source.name}
                  </a>
                  <span className='alcohol-information-source-organisation'>
                    {source.organisation}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </section>
  )
}
