import { ApiError } from '../../api/client';
import { openDialog } from '../../ui/dialog/dialogStore';
import type { ToastAction } from '../../ui/toast/toastStore';
import { useCommandLogStore } from '../shell/commandLogStore';
import { ErrorDialog } from './ErrorDialog';

/** The "Details" button of an error toast, for failures of a `cm` command. */
export function errorDetailsAction(title: string, error: unknown): ToastAction | undefined {
  if (!(error instanceof ApiError) || !error.command) return undefined;
  const { command, message } = error;

  return {
    label: 'Details',
    run: () =>
      openDialog((close) => (
        <ErrorDialog
          title={title}
          message={message}
          command={command}
          onShowInLog={canShowInLog(command.logEntryId) ? () => useCommandLogStore.getState().reveal(command.logEntryId) : undefined}
          onClose={close}
        />
      )),
  };
}

/** The log panel lives in the workspace screen, and it keeps only the latest commands. */
function canShowInLog(entryId: number): boolean {
  const { hosted, entries } = useCommandLogStore.getState();
  return hosted && entries.some((entry) => entry.id === entryId);
}
