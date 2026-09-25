import { api } from '../../api/client';
import { invalidateWorkspace } from '../queryClient';
import { toast, useToastStore, type ToastAction } from '../../ui/toast/toastStore';
import { describeProgressLine } from './describeProgressLine';
import { runningOperationOf, useRunningOperationsStore, type WorkspaceChangingOperation } from './runningOperationsStore';

interface OperationOptions<T> {
  /** Shown while running, e.g. "Updating workspace". */
  title: string;
  workspacePath: string;
  run: (operationId: string) => Promise<T>;
  /** Success message; return null to stay silent. */
  successMessage?: (result: T) => string | null;
  successAction?: (result: T) => ToastAction | undefined;
  cancellable?: boolean;
  /** Set for operations that change the loaded revisions: they don't start while another operation runs on the workspace. */
  kind?: WorkspaceChangingOperation;
}

/**
 * Runs a long `cm` operation with a live progress toast, then refreshes the workspace views.
 * Resolves with the operation's result, or `undefined` if it failed (the error is shown to the user).
 */
export async function runOperation<T>({
  title,
  workspacePath,
  run,
  successMessage,
  successAction,
  cancellable = true,
  kind,
}: OperationOptions<T>): Promise<T | undefined> {
  if (kind && refuseWhileBusy(workspacePath)) return undefined;

  const operationId = crypto.randomUUID();
  const operations = useRunningOperationsStore.getState();
  operations.start({ id: operationId, workspacePath, kind, title, detail: null });
  const toasts = useToastStore.getState();
  const toastId = toasts.show({
    kind: 'progress',
    title,
    action: cancellable ? { label: 'Cancel', run: () => void api.system.cancelOperation(operationId) } : undefined,
  });

  const stopListening = window.uvcs.on('operationProgress', (progress) => {
    if (progress.operationId !== operationId) return;
    const detail = describeProgressLine(progress.line);
    if (!detail) return;
    toasts.update(toastId, { detail });
    operations.report(operationId, detail);
  });

  try {
    const result = await run(operationId);
    toasts.dismiss(toastId);
    const message = successMessage?.(result);
    if (message) toast.success(message, undefined, successAction?.(result));
    return result;
  } catch (error) {
    toasts.dismiss(toastId);
    toast.error(`${title} failed`, error);
    return undefined;
  } finally {
    stopListening();
    operations.finish(operationId);
    void invalidateWorkspace(workspacePath);
  }
}

/**
 * Tells the user and returns true when another operation runs on the workspace, so one that changes the loaded
 * revisions must not start. Check it before asking anything about such an operation.
 */
export function refuseWhileBusy(workspacePath: string): boolean {
  const running = runningOperationOf(workspacePath);
  if (running) toast.info(`${running.title} is still running`, 'Wait for it to finish, or cancel it, before starting something else.');
  return Boolean(running);
}

/** Runs a quick action, reporting failures; refreshes the workspace views afterwards. */
export async function runAction<T>(workspacePath: string, failureTitle: string, action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    toast.error(failureTitle, error);
    return undefined;
  } finally {
    void invalidateWorkspace(workspacePath);
  }
}

/**
 * Like `runAction` for actions without a result: resolves to whether it succeeded,
 * since `undefined` can't tell a failure from a successful `void` action.
 */
export async function runVoidAction(workspacePath: string, failureTitle: string, action: () => Promise<void>): Promise<boolean> {
  const succeeded = await runAction(workspacePath, failureTitle, async () => {
    await action();
    return true;
  });
  return succeeded === true;
}
