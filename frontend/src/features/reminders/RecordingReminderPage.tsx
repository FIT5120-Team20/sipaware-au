import { applicationHref } from '../../app/entryPaths'
import { ReferenceBackBar } from '../drinks/components/ReferenceBackBar'
import { ReminderSettings } from './ReminderSettings'
import './reminderSettings.css'

export function RecordingReminderPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  return <main className="reference-home recording-reminder-page">
    <ReferenceBackBar label="Back to Home" href={applicationHref('/')} onClick={onNavigate ? () => onNavigate('/') : undefined} />
    <header className="recording-reminder-header">
      <div className="reference-page-heading"><h1>Recording reminder</h1></div>
      <p>Get a gentle reminder to check in each day.</p>
    </header>
    <ReminderSettings />
  </main>
}
