import type { UnexpectedError } from '@shared/events';
import { bugReportUrl } from '@shared/issueForms';
import { aboutDetails } from '../about/aboutDetails';
import type { ReportingAppInfo } from '../about/aboutIssueUrls';

/** What the toast of an unexpected error is titled, and its bug report after it. */
export const UNEXPECTED_ERROR_TITLE = 'Something went wrong';

/**
 * Chromium reports a `ResizeObserver` whose callback changed the layout it observes as a window error, though nothing
 * failed: the observer just runs again on the next frame.
 */
const BENIGN_WINDOW_ERRORS = [/^ResizeObserver loop/];

/**
 * An error the page didn't catch (a window `error` event's error, or an `unhandledrejection`'s reason) as the main
 * process describes its own (`describeUnexpectedError`); null for what is no failure of the app.
 */
export function describeWindowError(reason: unknown, fallbackMessage = ''): UnexpectedError | null {
  // A window error with no error object carries its words in its message: Chromium's ResizeObserver error has `null`.
  const message = reason instanceof Error ? reason.message || reason.name : reason === undefined || reason === null ? fallbackMessage : String(reason);
  if (BENIGN_WINDOW_ERRORS.some((benign) => benign.test(message))) return null;
  const details = reason instanceof Error ? (reason.stack ?? `${reason.name}: ${message}`) : message;
  return { message: message || 'Unknown error', details: details || 'Unknown error' };
}

/**
 * An error thrown while rendering (`AppErrorBoundary`): as any window error, but never left out as benign, since the
 * screen it broke shows; with the components it was thrown in when React tells them, for the log file.
 */
export function renderError(reason: unknown, componentStack?: string | null): UnexpectedError {
  const error = describeWindowError(reason) ?? { message: String(reason), details: String(reason) };
  return componentStack ? { ...error, details: `${error.details}\nIn components:${componentStack}` } : error;
}

/** The bug report on an unexpected error: titled with its words, the app's details and its stack filled in. */
export function unexpectedErrorIssueUrl(info: ReportingAppInfo, cmVersion: string | undefined, error: UnexpectedError): string {
  return bugReportUrl(info.issuesUrl, {
    title: `${UNEXPECTED_ERROR_TITLE}: ${error.message}`,
    appDetails: aboutDetails(info, cmVersion),
    errorDetails: error.details,
  });
}
