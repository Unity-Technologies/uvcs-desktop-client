import type { TrackerErrorReason } from '@shared/domain/issueTrackers';

/**
 * Why a tracker didn't answer (docs/features/issue-trackers.md, "Errors"). Its message names the host and the path,
 * never a query string, a header or a body, so it can be logged and shown.
 */
export class TrackerError extends Error {
  constructor(
    readonly reason: TrackerErrorReason,
    message: string,
    /** Until when the tracker asked to be left alone (`rateLimited`), ms since the epoch. */
    readonly until?: number,
    /** A refused sign-in the server sent to its login page (an SSO server's answer to a refused token). */
    readonly toLogin = false,
  ) {
    super(message);
    this.name = 'TrackerError';
  }
}

export function isTrackerError(error: unknown): error is TrackerError {
  return error instanceof TrackerError;
}
