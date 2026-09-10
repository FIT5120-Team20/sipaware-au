/**
 * Builds a stable, reload-safe topic destination with native anchor semantics.
 *
 * Typed topic codes keep entry-point links aligned with API-backed section IDs
 * without introducing personal state or calculations. Native anchors retain
 * their current application mount through the shared path helper.
 */
import { applicationHref } from '../../../app/entryPaths'
import type { ReactNode } from 'react'

import type { AlcoholInformationTopicCode } from '../types/alcoholGuideline'

interface AlcoholInformationTopicLinkProps {
  topicCode: AlcoholInformationTopicCode
  children: ReactNode
  className?: string
}

export function AlcoholInformationTopicLink({
  topicCode,
  children,
  className,
}: AlcoholInformationTopicLinkProps) {
  const classes = ['information-topic-link', className]
    .filter(Boolean)
    .join(' ')

  return (
    <a
      className={classes}
      href={applicationHref('/alcohol-guidelines#' + encodeURIComponent(topicCode))}
    >
      {children}
    </a>
  )
}
