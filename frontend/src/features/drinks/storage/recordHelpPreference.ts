/**
 * Browser-only preference for Record onboarding, separate from personal IndexedDB
 * records and shared site authentication. Only a seen flag is persisted; clearing
 * site data or using another browser starts onboarding again. No data is uploaded.
 */
export const RECORD_HELP_SEEN_KEY = 'sipaware.record-help.seen.v1'

/**
 * Lazily access storage because browser privacy settings may deny the getter or
 * writes. If persistence fails, retain dismissal for this page's lifetime so
 * navigation cannot repeatedly interrupt recording. A full reload then retries.
 * The factory gives isolated consumers/tests the same failure-tolerant contract.
 */
export function createRecordHelpPreference(
  storage: () => Pick<Storage, 'getItem' | 'setItem'> = () => window.localStorage,
) {
  let dismissedWithoutStorage = false
  return {
    hasSeen(): boolean {
      try {
        return dismissedWithoutStorage || storage().getItem(RECORD_HELP_SEEN_KEY) === '1'
      } catch {
        return dismissedWithoutStorage
      }
    },
    markSeen(): void {
      try {
        storage().setItem(RECORD_HELP_SEEN_KEY, '1')
      } catch {
        dismissedWithoutStorage = true
      }
    },
  }
}

export const recordHelpPreference = createRecordHelpPreference()
