/** Request-boundary policy for the public teacher root and retained iterations.
 * This selects the shared classroom gate only; backend device ownership and
 * scheduler authentication remain independent. Frozen copies keep their gate.
 */
export function requiresClassroomAccess(request) {
  try {
    // Decode conservatively so encoded separators cannot make an iteration look
    // like a public root route. Malformed input remains behind authentication.
    const pathname = decodeURIComponent(new URL(request.url).pathname).replaceAll('\\', '/');
    return /^\/(?:iteration\d+|access)(?:\/|$)/i.test(pathname);
  } catch {
    return true;
  }
}
