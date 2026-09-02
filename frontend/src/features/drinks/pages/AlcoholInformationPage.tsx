/**
 * Loads and presents verified public alcohol information independently from
 * browser-local DrinkingRecords, SavedDrinks, totals, and driving triggers.
 *
 * There is deliberately no hard-coded health or legal fallback: a failed or
 * malformed response stays visibly unavailable until a successful retry.
 */
import { useEffect, useState } from 'react'

import { getAlcoholInformation } from '../../../services/alcoholInformationApi'
import '../alcoholInformation.css'
import { AlcoholInformationSection } from '../components/AlcoholInformationSection'
import type { AlcoholInformationResponseDto } from '../types/alcoholInformation'
import {
  isAlcoholInformationTopicCode,
  type AlcoholInformationTopicCode,
} from '../types/alcoholGuideline'

type InformationLoadStatus = 'loading' | 'loaded' | 'failed'

interface HashTarget {
  value: string | null
  topicCode: AlcoholInformationTopicCode | null
}

function readHashTarget(): HashTarget {
  if (!window.location.hash) {
    return { value: null, topicCode: null }
  }

  const encodedValue = window.location.hash.slice(1)
  try {
    const value = decodeURIComponent(encodedValue)
    return {
      value,
      topicCode: isAlcoholInformationTopicCode(value) ? value : null,
    }
  } catch {
    return { value: encodedValue, topicCode: null }
  }
}

export function AlcoholInformationPage() {
  const [status, setStatus] =
    useState<InformationLoadStatus>('loading')
  const [information, setInformation] =
    useState<AlcoholInformationResponseDto | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [hashTarget, setHashTarget] = useState<HashTarget>(readHashTarget)

  useEffect(() => {
    const abortController = new AbortController()
    let isActive = true

    async function loadInformation() {
      setStatus('loading')
      setInformation(null)
      try {
        const response = await getAlcoholInformation(
          abortController.signal,
        )
        if (isActive) {
          setInformation(response)
          setStatus('loaded')
        }
      } catch {
        if (isActive && !abortController.signal.aborted) {
          setStatus('failed')
        }
      }
    }

    void loadInformation()
    return () => {
      isActive = false
      abortController.abort()
    }
  }, [loadAttempt])

  useEffect(() => {
    const handleHashChange = () => setHashTarget(readHashTarget())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Native anchors provide browser history and reload behaviour. Once async
  // content exists, focus follows only a validated requested topic so keyboard
  // and assistive-technology users receive the same deep-link destination.
  useEffect(() => {
    if (status !== 'loaded' || hashTarget.topicCode === null) {
      return
    }

    const section = document.getElementById(hashTarget.topicCode)
    const heading = section?.querySelector('h2')
    if (!(section instanceof HTMLElement) || !(heading instanceof HTMLElement)) {
      return
    }

    section.scrollIntoView()
    heading.focus()
  }, [hashTarget.topicCode, information, status])

  const requestedTopicIsMissing =
    status === 'loaded' &&
    hashTarget.topicCode !== null &&
    !information?.topics.some(
      (topic) => topic.topicCode === hashTarget.topicCode,
    )

  return (
    <main className='alcohol-information-page'>
      <div className='alcohol-information-shell'>
        <a className='alcohol-information-back-link' href='/'>
          Record a drink
        </a>

        <header className='alcohol-information-header'>
          <p className='brand-name'>SipAware AU</p>
          <h1>Alcohol Guidelines &amp; Legal Information</h1>
          <p>
            Explore verified public information and its trusted Australian
            sources.
          </p>
        </header>

        {hashTarget.value !== null && hashTarget.topicCode === null && (
          <p className='alcohol-information-target-message'>
            That information section was not found. All available information
            is shown below.
          </p>
        )}

        {status === 'loading' && (
          <p className='alcohol-information-status' role='status'>
            Loading alcohol information...
          </p>
        )}

        {status === 'failed' && (
          <div className='alcohol-information-error' role='alert'>
            <p>Alcohol information is temporarily unavailable.</p>
            <button
              className='secondary-button'
              type='button'
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              Retry
            </button>
          </div>
        )}

        {status === 'loaded' && information && (
          <>
            <nav
              className='alcohol-information-contents'
              aria-label='Alcohol information topics'
            >
              <h2>On this page</h2>
              <ul>
                {information.topics.map((topic) => (
                  <li key={topic.topicCode}>
                    <a href={'#' + encodeURIComponent(topic.topicCode)}>
                      {topic.displayName}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {requestedTopicIsMissing && (
              <p className='alcohol-information-target-message'>
                The requested information section is currently unavailable.
                Other verified information is shown below.
              </p>
            )}

            <div className='alcohol-information-sections'>
              {information.topics.map((topic) => (
                <AlcoholInformationSection
                  key={topic.topicCode}
                  topic={topic}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
