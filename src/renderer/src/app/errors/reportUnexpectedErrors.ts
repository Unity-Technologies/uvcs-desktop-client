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
  window.addEventListener('error', (event) => tellIfFailure(describeWindowError(event.error, event.message)));
  window.addEventListener('unhandledrejection', (event) => tellIfFailure(describeWindowError(event.reason)));
}

/** Opens the bug report on the error, with the app's details filled in, for the user to review in the browser. */
export async function reportUnexpectedError(error: UnexpectedError): Promise<void> {
  const info = await queryClient.fetchQuery(appInfoQuery);
  await api.system.openExternal(unexpectedErrorIssueUrl(info, queryClient.getQueryData(cmVersionQuery.queryKey), error));
}

function tellIfFailure(error: UnexpectedError | null): void {
  if (error) tellUnexpectedError(error);
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
