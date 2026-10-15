import { isReminderScheduler } from './security/reminderScheduler.mjs';
/** Root is public after the owner's release decision; retained iterations keep
 * their classroom login. Rewrites select independent copies, so the public root
 * copy also omits its login proxy. Backend device/scheduler auth is unchanged.
 */
import { requiresClassroomAccess } from './security/channelAccess.mjs';
import { next } from '@vercel/functions';
import { accessGate, privateHeaders } from './security/access.mjs';

export const config = { runtime: 'nodejs' };

export default async function middleware(request) {
  try {
    if (!requiresClassroomAccess(request)) return next({ headers: privateHeaders });
    if (isReminderScheduler(request)) return next({ headers: privateHeaders });
    return await accessGate(request) || next({ headers: privateHeaders });
  } catch {
    // Never leak password material or bypass the gate after a crypto/runtime error.
    return new Response('Site access is temporarily unavailable.', { status: 503, headers: privateHeaders });
  }
}
