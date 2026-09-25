import { api } from '../../api/client';
import { invalidateWorkspace } from '../queryClient';
import { toast, useToastStore, type ToastAction } from '../../ui/toast/toastStore';
import { describeProgressLine } from './describeProgressLine';

interface OperationOptions<T> {
  /** Shown while running, e.g. "Updating workspace". */
  title: string;
  workspacePath: string;
  run: (operationId: string) => Promise<T>;
  /** Success message; return null to stay silent. */
  successMessage?: (result: T) => string | null;
  successAction?: (result: T) => ToastAction | undefined;
  cancellable?: boolean;
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
}: OperationOptions<T>): Promise<T | undefined> {
  const operationId = crypto.randomUUID();
  const toasts = useToastStore.getState();
  const toastId = toasts.show({
    kind: 'progress',
    title,
    action: cancellable ? { label: 'Cancel', run: () => void api.system.cancelOperation(operationId) } : undefined,
  });

  const stopListening = window.uvcs.on('operationProgress', (progress) => {
    if (progress.operationId !== operationId) return;
    const detail = describeProgressLine(progress.line);
    if (detail) toasts.update(toastId, { detail });
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
    void invalidateWorkspace(workspacePath);
  }
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
