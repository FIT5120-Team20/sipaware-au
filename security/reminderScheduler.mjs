import { createHash, timingSafeEqual } from 'node:crypto';
/** Only this authenticated scheduler route may bypass the classroom cookie gate. */
export function isReminderScheduler(request, env = process.env) {
  const url = new URL(request.url);
  if (url.pathname !== '/iteration3/api/reminders/dispatch' || request.method !== 'POST') return false;
  const secret = env.REMINDER_CRON_SECRET || '';
  if (secret.length < 32) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(request.headers.get('authorization') || ''), digest('Bearer ' + secret));
}
