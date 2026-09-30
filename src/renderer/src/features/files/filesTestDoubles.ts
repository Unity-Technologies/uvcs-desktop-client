import type { OperationSuccess } from '../../app/operations/runOperation';
import type { ToastAction } from '../../ui/toast/toastStore';

/**
 * For tests of the Files view's actions: stand-ins for the main process (`api`), the operations that run and report
 * them (`runOperation`, `runAction`), the dialogs and the toasts, recording what each was asked. Mocked in a test with
 * `vi.mock('../../api/client', () => import('./filesTestDoubles').then(({ fakeApi }) => ({ api: fakeApi })))`.
 */

/** A call to the main process: `explorer.moveItems` and its arguments. */
export interface ApiCall {
  method: string;
  args: unknown[];
}

export const doubles = {
  calls: [] as ApiCall[],
  /** Answers by method (`explorer.listDirectory`); a method without one answers undefined. */
  answers: {} as Record<string, (...args: unknown[]) => unknown>,
  /** What the user answers the next dialogs, in order: a confirm's true or false, a prompt's text or null. */
  dialogAnswers: [] as unknown[],
  dialogs: [] as { kind: 'confirm' | 'prompt'; title: string; validate?: (value: string) => string | undefined }[],
  toasts: [] as { kind: 'success' | 'info' | 'error'; title: string; detail?: string; action?: ToastAction }[],

  reset(): void {
    doubles.calls = [];
    doubles.answers = {};
    doubles.dialogAnswers = [];
    doubles.dialogs = [];
    doubles.toasts = [];
  },

  /** The calls to the main process that change something (reads left out). */
  get writes(): ApiCall[] {
    return doubles.calls.filter((call) => !/\.(listDirectory|read|get)$/.test(call.method));
  },
};

export const fakeApi = new Proxy(
  {},
  {
    get: (_api, area: string) =>
      new Proxy(
        {},
        {
          get: (_area, name: string) =>
            async (...args: unknown[]) => {
              const method = `${area}.${name}`;
              doubles.calls.push({ method, args });
              return doubles.answers[method]?.(...args);
            },
        },
      ),
  },
);

export const fakeToast = {
  success: (title: string, detail?: string, action?: ToastAction) => void doubles.toasts.push({ kind: 'success', title, detail, action }),
  info: (title: string, detail?: string, action?: ToastAction) => void doubles.toasts.push({ kind: 'info', title, detail, action }),
  error: (title: string, error?: unknown) => void doubles.toasts.push({ kind: 'error', title, detail: error instanceof Error ? error.message : undefined }),
};

export async function fakeConfirm(options: { title: string }): Promise<boolean> {
  doubles.dialogs.push({ kind: 'confirm', title: options.title });
  return (doubles.dialogAnswers.shift() as boolean | undefined) ?? true;
}

export async function fakePrompt(options: { title: string; validate?: (value: string) => string | undefined }): Promise<string | null> {
  doubles.dialogs.push({ kind: 'prompt', title: options.title, validate: options.validate });
  return (doubles.dialogAnswers.shift() as string | null | undefined) ?? null;
}

/** Runs the operation as `runOperation` does, its success or failure told in a toast. */
export async function fakeRunOperation<T>({ title, run, success }: { title: string; run: (operationId: string) => Promise<T>; success?: (result: T) => OperationSuccess | null }): Promise<T | undefined> {
  try {
    const result = await run('operation-1');
    const ending = success?.(result);
    if (ending) fakeToast.success(ending.title, ending.detail, ending.action);
    return result;
  } catch (error) {
    fakeToast.error(`${title} failed`, error);
    return undefined;
  }
}

/** Every step of an action started from a toast or a menu (not awaited there) is done: the doubles answer at once. */
export function settled(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Runs the action as `runAction` does, its failure told in a toast. */
export async function fakeRunAction<T>(_workspacePath: string, failureTitle: string, action: () => Promise<T>): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    fakeToast.error(failureTitle, error);
    return undefined;
  }
}
