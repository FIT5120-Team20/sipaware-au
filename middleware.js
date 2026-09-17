/** Deployment-wide access boundary, including assets, APIs and retained origins.
 * Identical gate/configuration must be deployed on the retained copy as well.
 * Existing Vercel rewrites remain responsible for choosing the content version.
 */
import { next } from '@vercel/functions';
import { accessGate, privateHeaders } from './security/access.mjs';

export const config = { runtime: 'nodejs' };

export default async function middleware(request) {
  try {
    return await accessGate(request) || next({ headers: privateHeaders });
  } catch {
    // Never leak password material or bypass the gate after a crypto/runtime error.
    return new Response('Site access is temporarily unavailable.', { status: 503, headers: privateHeaders });
  }
}
