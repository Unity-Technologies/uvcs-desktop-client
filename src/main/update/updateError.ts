const OFFLINE_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);
const MAX_LENGTH = 140;

/**
 * A failed update check or download in one short sentence the user can read. electron-updater reports an HTTP failure
 * as the whole response, request line and every header, `Set-Cookie` tokens included: shown as is it would fill the
 * About dialog and leak them, so known cases get a sentence and the rest keep their first clause only.
 */
export function describeUpdateError(error: unknown): string {
  const { code, statusCode } = (error ?? {}) as { code?: unknown; statusCode?: unknown };
  const message = error instanceof Error ? error.message : String(error ?? '');

  if ((typeof code === 'string' && OFFLINE_CODES.has(code)) || /net::|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
    return "Couldn't reach the update server. Check your connection and try again.";
  }
  // No published release to update from yet (only a draft), or a feed that can't be read without signing in.
  if (statusCode === 404 || /\b404\b/.test(message)) return 'No published release is available to update from yet.';

  const firstClause = message
    .split(/Headers:|\r?\n/)[0]!
    .replace(/^[A-Za-z]*Error:\s*/, '')
    .trim();
  const clause = firstClause || 'Unknown error';
  return clause.length > MAX_LENGTH ? `${clause.slice(0, MAX_LENGTH)}…` : clause;
}
