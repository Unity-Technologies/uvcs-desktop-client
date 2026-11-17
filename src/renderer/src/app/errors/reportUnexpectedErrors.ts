import type { UnexpectedError } from '@shared/events';
import { api } from '../../api/client';
import { useToastStore } from '../../ui/toast/toastStore';
import { appInfoQuery } from '../about/appInfoQuery';
import { queryClient } from '../queryClient';
import { cmVersionQuery } from '../startup/useCmAvailability';
import { describeWindowError, UNEXPECTED_ERROR_TITLE, unexpectedErrorIssueUrl } from './unexpectedErrors';

/** Messages already told in this window: an error that repeats (a timer, a listener) tells once. */
const told = new Set<string>();

/**
 * Tells the user of every error nothing caught, the main process's (`unexpectedError`) and the page's own (window
 * `error` and `unhandledrejection` events), in an error toast that offers to report it. Errors React catches while
 * rendering show `AppErrorBoundary`'s screen instead. Called once, as the page starts.
 */
export function reportUnexpectedErrors(): void {
  window.uvcs.on('unexpectedError', (error) => {
    // Shown in the page's console too, where development and the smoke test look for errors; the page's own are there already.
    console.error(`${UNEXPECTED_ERROR_TITLE} in the main process: ${error.details}`);
    tellUnexpectedError(error);
  });
  window.addEventListener('error', (event) => tellWindowError(describeWindowError(event.error, event.message)));
  window.addEventListener('unhandledrejection', (event) => tellWindowError(describeWindowError(event.reason)));
}

/**
 * Writes an error of the window's own to the log file a user sends with a bug report (the main process logs its
 * own). A window that can't reach main to log it has nothing better to do with the failure.
 */
export function logWindowError(error: UnexpectedError): void {
  api.system.logUnexpectedError(error).catch(() => undefined);
}

/** Opens the bug report on the error, with the app's details filled in, for the user to review in the browser. */
export async function reportUnexpectedError(error: UnexpectedError): Promise<void> {
  const info = await queryClient.fetchQuery(appInfoQuery);
  await api.system.openExternal(unexpectedErrorIssueUrl(info, queryClient.getQueryData(cmVersionQuery.queryKey), error));
}

/** The window's own error, logged and told once per message, as one that repeats (a timer, a listener) would flood both. */
function tellWindowError(error: UnexpectedError | null): void {
  if (!error || told.has(error.message)) return;
  logWindowError(error);
  tellUnexpectedError(error);
}

function tellUnexpectedError(error: UnexpectedError): void {
  if (told.has(error.message)) return;
  told.add(error.message);
  useToastStore.getState().show({
    kind: 'error',
    title: UNEXPECTED_ERROR_TITLE,
    detail: error.message,
    action: { label: 'Report an Issue', run: () => void reportUnexpectedError(error) },
  });
}
