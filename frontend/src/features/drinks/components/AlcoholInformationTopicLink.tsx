/**
 * Builds a stable, reload-safe topic destination with native anchor semantics.
 *
 * Typed topic codes keep entry-point links aligned with API-backed section IDs
 * without introducing personal state, calculations, or a routing abstraction.
 */
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
      href={'/alcohol-guidelines#' + encodeURIComponent(topicCode)}
    >
      {children}
    </a>
  )
}
