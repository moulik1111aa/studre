// MN Access's stand-in cloud (`?mock`, ui tests and trying the page out) works only on this
// computer, never on the live page (review fix 18).

/** A page served from this computer (or opened as a file). */
export const isLocal = (hostname: string): boolean => ['localhost', '127.0.0.1', '[::1]', '::1', ''].includes(hostname) || hostname.endsWith('.localhost');
