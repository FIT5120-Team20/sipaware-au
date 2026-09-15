/** Entry paths preserve navigation state without rewriting public API or storage URLs. */
import { afterEach, describe, expect, it } from 'vitest'
import { applicationHref, applicationPath } from '../../../../frontend/src/app/entryPaths'

afterEach(() => window.history.replaceState({}, '', '/'))

describe('standalone and active iteration navigation', () => {
  it('recognizes root and the exact active mount, without claiming future releases', () => {
    for (const root of ['', '/iteration2']) {
      expect(applicationPath(root || '/')).toBe('/')
      expect(applicationPath(root + '/')).toBe('/')
      expect(applicationPath(root + '/record')).toBe('/record')
      expect(applicationPath(root + '/alcohol-guidelines')).toBe('/alcohol-guidelines')
    }
    for (const unknown of ['/iteration1', '/iteration1/record', '/iteration20', '/iteration2-other', '/iteration3', '/iteration3/record']) {
      expect(applicationPath(unknown)).toBe(unknown)
    }
  })

  it.each(['', '/iteration2'])('keeps navigation, query and hash in entry %s', (mount) => {
    window.history.replaceState({}, '', mount + '/record')
    expect(applicationHref('/')).toBe(mount || '/')
    expect(applicationHref('/record?record=synthetic-id')).toBe(mount + '/record?record=synthetic-id')
    expect(applicationHref('/alcohol-guidelines#STANDARD_DRINK')).toBe(mount + '/alcohol-guidelines#STANDARD_DRINK')
    expect(applicationHref('/trends#history')).toBe(mount + '/trends#history')
  })

  it('does not rewrite API, assets, external sources or already mounted links', () => {
    window.history.replaceState({}, '', '/iteration2')
    for (const url of ['/api/reference/drink-options', '/reference-ui/home-ageing.svg', 'https://example.com/source', '//example.com/source', '#ALCOHOL_AGEING', '/iteration2/record']) {
      expect(applicationHref(url)).toBe(url)
    }
  })
})
