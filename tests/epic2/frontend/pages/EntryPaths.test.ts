/** Public route compatibility must not change API destinations or personal-data storage. */
import { afterEach, describe, expect, it } from 'vitest'
import { applicationHref, applicationPath, officialEntryRedirect } from '../../../../frontend/src/app/entryPaths'

afterEach(() => window.history.replaceState({}, '', '/'))

describe('approved iteration entry', () => {
  it('recognizes the exact mount and its nested application pages', () => {
    expect(applicationPath('/iteration1')).toBe('/')
    expect(applicationPath('/iteration1/')).toBe('/')
    expect(applicationPath('/iteration1/record')).toBe('/record')
    expect(applicationPath('/iteration1/alcohol-guidelines')).toBe('/alcohol-guidelines')
    expect(applicationPath('/iteration10')).toBe('/iteration10')
    expect(applicationPath('/iteration2')).toBe('/iteration2')
  })

  it('keeps links, query state and topic hashes in the current mount', () => {
    window.history.replaceState({}, '', '/iteration1/record')
    expect(applicationHref('/')).toBe('/iteration1')
    expect(applicationHref('/record?record=synthetic-id')).toBe('/iteration1/record?record=synthetic-id')
    expect(applicationHref('/alcohol-guidelines#STANDARD_DRINK')).toBe('/iteration1/alcohol-guidelines#STANDARD_DRINK')
    expect(applicationHref('/trends#trends')).toBe('/iteration1/trends#trends')
  })

  it('keeps local root navigation and non-app URLs unchanged', () => {
    expect(applicationHref('/record')).toBe('/record')
    window.history.replaceState({}, '', '/iteration1')
    for (const url of ['/api/reference/drink-options', '/reference-ui/home-ageing.svg', 'https://example.com/source', '//example.com/source', '#ALCOHOL_AGEING', '/iteration1/record']) {
      expect(applicationHref(url)).toBe(url)
    }
  })

  it('canonicalizes known legacy bookmarks without adding the old prefix', () => {
    expect(officialEntryRedirect({hostname: 'sipaware.app', pathname: '/iteration1', search: '', hash: ''})).toBe('/')
    expect(officialEntryRedirect({hostname: 'sipaware.app', pathname: '/iteration1/alcohol-guidelines', search: '?view=source', hash: '#STANDARD_DRINK'})).toBe('/alcohol-guidelines?view=source#STANDARD_DRINK')
    expect(officialEntryRedirect({hostname: 'sipaware-au.vercel.app', pathname: '/iteration1/record', search: '', hash: ''})).toBe('/record')
  })

  it('keeps root pages, local/frozen hosts and unrelated routes independent', () => {
    for (const [hostname, pathname] of [['localhost', '/'], ['sipaware-au-iteration1.vercel.app', '/'], ['sipaware.app', '/'], ['sipaware.app', '/record'], ['sipaware.app', '/trends'], ['sipaware.app', '/alcohol-guidelines'], ['sipaware.app', '/iteration1/unknown'], ['sipaware.app', '/iteration10'], ['sipaware-au-iteration1.vercel.app', '/iteration1'], ['sipaware.app', '/iteration2'], ['sipaware.app', '/unknown']]) {
      expect(officialEntryRedirect({hostname, pathname, search: '', hash: ''})).toBeNull()
    }
  })
})
