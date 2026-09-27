import { ApiError, api } from '../../api/client';
import { useCommandLogStore } from '../shell/commandLogStore';
import { invalidateWorkspace } from '../queryClient';
import { toast, useToastStore, type Toast, type ToastAction } from '../../ui/toast/toastStore';
import { describeCompletion } from './describeProgress';
import { stopOnce } from './stopOnce';
import { blockingOperation, operationById, useRunningOperationsStore, type WorkspaceChangingOperation } from './runningOperationsStore';

/** How an operation's card ends when it succeeds. */
export type OperationSuccess = Pick<Toast, 'title' | 'detail' | 'action'> & { kind?: 'success' | 'info' };

interface OperationOptions<T> {
  /** Shown while running, e.g. "Updating workspace". */
  title: string;
  workspacePath: string;
  run: (operationId: string) => Promise<T>;
  /** Success message; return null to stay silent. */
  successMessage?: (result: T) => string | null;
  successAction?: (result: T) => ToastAction | undefined;
  /** The whole ending, for operations whose outcome needs more than a message (a switch and its changes). */
  success?: (result: T) => OperationSuccess | null;
  /** Whether it may be stopped at all; its progress also tells when it can't be stopped anymore. */
  cancellable?: boolean;
  /**
   * Set for operations that change the loaded revisions: they don't start while another operation runs on the workspace,
   * and no other one starts while they run.
   */
  kind?: WorkspaceChangingOperation;
  /**
   * Explains a failure it recognizes in its own way (returns true), which then isn't flagged as a failure in the status
   * bar; otherwise the failure shows as an error toast.
   */
  onFailure?: (error: unknown) => boolean;
  /** The views it can change (`refreshScopes`), refreshed when it ends; every view by default. */
  affects?: (queryKey: readonly unknown[]) => boolean;
}

/**
 * Runs a long `cm` operation with a live progress card, then refreshes the workspace views. On success the card turns
 * into the message (with what was done, counted from the last progress) and goes away by itself.
 * Resolves with the operation's result, or `undefined` if it failed (the error is shown to the user).
 */
export async function runOperation<T>({
  title,
  workspacePath,
  run,
  successMessage,
  successAction,
  success,
  cancellable = true,
  kind,
  onFailure,
  affects,
}: OperationOptions<T>): Promise<T | undefined> {
  if (refuseWhileBusy(workspacePath, kind !== undefined)) return undefined;

  const operationId = crypto.randomUUID();
  const operations = useRunningOperationsStore.getState();
  operations.start({ id: operationId, workspacePath, kind, title });
  const toasts = useToastStore.getState();
  let cancelRequested = false;
  const cancel = stopOnce(
    () => {
      cancelRequested = true;
      void api.system.cancelOperation(operationId);
    },
    () => toasts.update(toastId, { action: { label: 'Stopping…', run: () => {}, disabled: true } }),
  );
  const toastId = toasts.show({ kind: 'progress', title, operationId, action: cancellable ? { label: 'Cancel', run: cancel } : undefined });

  const stopListening = window.uvcs.on('operationProgress', (event) => {
    if (event.operationId === operationId) operations.report(operationId, event.progress);
  });

  try {
    const result = await run(operationId);
    const ending = success ? success(result) : endingFromMessage(successMessage?.(result), successAction?.(result));
    if (ending) {
      const lastProgress = operationById(operationId)?.progress ?? null;
      toasts.update(toastId, {
        kind: ending.kind ?? 'success',
        title: ending.title,
        detail: ending.detail ?? describeCompletion(lastProgress) ?? undefined,
        action: ending.action,
      });
    } else {
      toasts.dismiss(toastId);
    }
    return result;
  } catch (error) {
    toasts.dismiss(toastId);
    if (cancelRequested) toast.info('Stopped', `${title} was stopped.`);
    else if (onFailure?.(error)) markHandled(error);
    else toast.error(`${title} failed`, error);
    return undefined;
  } finally {
    stopListening();
    operations.finish(operationId);
    void invalidateWorkspace(workspacePath, affects);
  }
}

function endingFromMessage(message: string | null | undefined, action: ToastAction | undefined): OperationSuccess | null {
  return message ? { title: message, action } : null;
}

/** A failure the operation explained in its own way is no failure to point at in the status bar. */
function markHandled(error: unknown): void {
  if (error instanceof ApiError && error.command) useCommandLogStore.getState().markHandled(error.command.logEntryId);
}

/**
 * Tells the user and returns true when an operation can't start on the workspace now (`blockingOperation`): by
 * default one that changes the loaded revisions. Check it before asking anything about such an operation.
 */
export function refuseWhileBusy(workspacePath: string, changesLoadedRevisions = true): boolean {
  const running = blockingOperation(useRunningOperationsStore.getState().operations, workspacePath, changesLoadedRevisions);
  if (running) toast.info(`${running.title} is still running`, 'Wait for it to finish, or cancel it, before starting something else.');
  return Boolean(running);
}

/** Runs a quick action, reporting failures; refreshes the views it `affects` afterwards (`refreshScopes`), every view by default. */
export async function runAction<T>(
  workspacePath: string,
  failureTitle: string,
  action: () => Promise<T>,
  affects?: (queryKey: readonly unknown[]) => boolean,
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    toast.error(failureTitle, error);
    return undefined;
  } finally {
    void invalidateWorkspace(workspacePath, affects);
  }
}

/**
 * Runs a read, or an action that leaves the workspace and repository as they were (opening a file), reporting
 * failures. Unlike `runAction`, it refreshes nothing: nothing changed.
 */
export async function runRead<T>(failureTitle: string, read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    toast.error(failureTitle, error);
    return undefined;
  }
}

/**
 * Like `runAction` for actions without a result: resolves to whether it succeeded,
 * since `undefined` can't tell a failure from a successful `void` action.
 */
export async function runVoidAction(
  workspacePath: string,
  failureTitle: string,
  action: () => Promise<void>,
  affects?: (queryKey: readonly unknown[]) => boolean,
): Promise<boolean> {
  const succeeded = await runAction(
    workspacePath,
    failureTitle,
    async () => {
      await action();
      return true;
    },
    affects,
  );
  return succeeded === true;
}
