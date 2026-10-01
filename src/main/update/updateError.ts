const OFFLINE_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);

/**
 * Where electron-updater's report stops being the cause: the response's headers (`Set-Cookie` tokens included) and the
 * releases feed it read (`Cannot parse releases feed: …,\nXML:\n<feed>`).
 */
const NOT_THE_CAUSE = /\r?\nHeaders:|,?\r?\nXML:/;

/** A failure the app words itself, for the user: `describeUpdateError` shows its message as it is. */
export class UpdateFailure extends Error {}

/**
 * A failed update check or download in one short sentence the user can read. electron-updater's own messages are for
 * developers: wrapped two or three times, with the response's headers and the whole feed, so none of them reaches the
 * screen; known cases get a sentence, the rest one calm line, and the cause goes to the log (`updateErrorForLog`).
 */
export function describeUpdateError(error: unknown): string {
  if (error instanceof UpdateFailure) return error.message;

  const { code, statusCode } = (error ?? {}) as { code?: unknown; statusCode?: unknown };
  // The cause only: the feed after it could hold any word, a 404 in a release's notes included.
  const cause = updateErrorForLog(error ?? '');

  if ((typeof code === 'string' && OFFLINE_CODES.has(code)) || /net::|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(cause)) {
    return "Couldn't reach the update server. Check your connection and try again.";
  }
  // No published release to update from yet: the repository holds only a draft, or no release at all.
  if (statusCode === 404 || /\b404\b/.test(cause)) return 'No published release is available to update from yet.';
  // GitHub answering oddly for a moment (a release just published, a rate limit, an outage): the next check passes.
  return "GitHub didn't answer as expected. Try again in a moment.";
}

/**
 * A failed update's cause for the log, cut before the response's headers and the feed (`NOT_THE_CAUSE`). The message
 * holds the whole chain: electron-updater writes each wrapped error's stack into the next one's message.
 */
export function updateErrorForLog(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.split(NOT_THE_CAUSE)[0]!;
}
