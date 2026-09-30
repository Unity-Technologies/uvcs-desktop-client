import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';

const uvcs = await vi.hoisted(async () => (await import('../../lib/testing/fakeWindow')).installFakeWindow());
const refreshed = vi.hoisted(() => vi.fn(async (_workspacePath: string, _affected?: (key: readonly unknown[]) => boolean) => {}));
vi.mock('../queryClient', () => ({ invalidateWorkspace: refreshed }));

import { ApiError } from '../../api/client';
import { useToastStore, type Toast } from '../../ui/toast/toastStore';
import { useCommandLogStore } from '../shell/commandLogStore';
import { refuseWhileBusy, runAction, runOperation, runRead, runVoidAction } from './runOperation';
import { useRunningOperationsStore } from './runningOperationsStore';

const ws = '/work/game';
const affectsBranches = (key: readonly unknown[]) => key[2] === 'branches';

beforeEach(() => {
  uvcs.reset();
  refreshed.mockClear();
  useToastStore.setState({ toasts: [] });
  useRunningOperationsStore.setState({ operations: [] });
  useCommandLogStore.setState({ handledIds: new Set() });
});

/** Operations a test left running are ended with it, so none of their listeners outlive it. */
const unfinished: { command: ReturnType<typeof pending<string>>; result: Promise<unknown> }[] = [];

afterEach(async () => {
  unfinished.forEach(({ command }) => command.resolve('ended with the test'));
  await Promise.all(unfinished.splice(0).map(({ result }) => result));
});

/** A promise the test settles when it wants, standing for a `cm` command still running. */
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

/** Starts an operation whose command runs until the test ends it; returns its id once it started. */
function startOperation(options: Partial<Parameters<typeof runOperation<string>>[0]> = {}) {
  const command = pending<string>();
  let operationId = '';
  const result = runOperation<string>({
    title: 'Updating workspace',
    workspacePath: ws,
    run: (id) => {
      operationId = id;
      return command.promise;
    },
    ...options,
  });
  unfinished.push({ command, result });
  return { result, command, id: () => operationId };
}

const toasts = (): Toast[] => useToastStore.getState().toasts;
const card = (): Toast | undefined => toasts().find((toast) => toast.operationId !== undefined);
const operations = () => useRunningOperationsStore.getState().operations;

function progress(changes: Partial<OperationProgress> = {}): OperationProgress {
  return { stage: 'downloading', stageLabel: 'Downloading', fraction: 0.5, ...changes };
}

describe('runOperation while it runs', () => {
  it('shows a progress card with Cancel and lists the operation as running on its workspace', () => {
    const { id } = startOperation({ kind: 'update' });

    expect(card()).toMatchObject({ kind: 'progress', title: 'Updating workspace', operationId: id(), action: { label: 'Cancel' } });
    expect(operations()).toMatchObject([{ id: id(), workspacePath: ws, kind: 'update', title: 'Updating workspace', progress: null }]);
  });

  it('offers no Cancel when the operation cannot be stopped', () => {
    startOperation({ cancellable: false });

    expect(card()?.action).toBeUndefined();
  });

  it('keeps the progress main reports for this operation only', () => {
    const { id } = startOperation();

    uvcs.emit('operationProgress', { operationId: 'another', progress: progress({ fraction: 0.9 }) });
    uvcs.emit('operationProgress', { operationId: id(), progress: progress({ fraction: 0.25 }) });

    expect(operations()[0]?.progress).toEqual(progress({ fraction: 0.25 }));
  });
});

describe('runOperation when it ends', () => {
  it('turns the card into the success message, with what was done counted from the last progress', async () => {
    const { result, command, id } = startOperation({ successMessage: () => 'Workspace updated' });
    uvcs.emit('operationProgress', { operationId: id(), progress: progress({ total: 3, bytesTotal: 2048 }) });

    command.resolve('cs:12');

    await expect(result).resolves.toBe('cs:12');
    expect(card()).toMatchObject({ kind: 'success', title: 'Workspace updated', detail: '3 files updated · 2.0 KB' });
  });

  it('ends as the whole success the operation describes, info included', async () => {
    const { result, command } = startOperation({ success: (branch) => ({ kind: 'info', title: `On ${branch}`, detail: 'Changes kept' }) });

    command.resolve('/main/task');
    await result;

    expect(card()).toMatchObject({ kind: 'info', title: 'On /main/task', detail: 'Changes kept' });
  });

  it('takes the card away when there is nothing to say', async () => {
    const { result, command } = startOperation({ successMessage: () => null });

    command.resolve('done');
    await result;

    expect(toasts()).toEqual([]);
  });

  it('stops listening to progress and no longer lists the operation, whatever the outcome', async () => {
    const succeeding = startOperation();
    const failing = startOperation({ workspacePath: '/work/other' });
    expect(uvcs.listenerCount('operationProgress')).toBe(2);

    succeeding.command.resolve('ok');
    failing.command.reject(new Error('boom'));
    await Promise.all([succeeding.result, failing.result]);

    expect(uvcs.listenerCount('operationProgress')).toBe(0);
    expect(operations()).toEqual([]);
  });

  it('refreshes the views it affects on its workspace, after a success and after a failure', async () => {
    const succeeding = startOperation({ affects: affectsBranches });
    succeeding.command.resolve('ok');
    await succeeding.result;
    const failing = startOperation({ affects: affectsBranches });
    failing.command.reject(new Error('boom'));
    await failing.result;

    expect(refreshed.mock.calls).toEqual([
      [ws, affectsBranches],
      [ws, affectsBranches],
    ]);
  });

  it('refreshes every view when it does not say what it affects', async () => {
    const { result, command } = startOperation();
    command.resolve('ok');
    await result;

    expect(refreshed).toHaveBeenCalledWith(ws, undefined);
  });
});

describe('runOperation when it fails', () => {
  it('resolves undefined and shows "<title> failed" with the reason instead of the card', async () => {
    const { result, command } = startOperation();

    command.reject(new Error('The workspace is locked'));

    await expect(result).resolves.toBeUndefined();
    expect(toasts()).toMatchObject([{ kind: 'error', title: 'Updating workspace failed', detail: 'The workspace is locked' }]);
  });

  it('leaves a failure the operation explains itself unflagged in the command log, and shows no error', async () => {
    const failure = new ApiError({ message: 'rejected', command: { commandLine: 'cm ci', exitCode: 1, output: '', logEntryId: 31 } });
    const { result, command } = startOperation({ onFailure: () => true });

    command.reject(failure);
    await result;

    expect(toasts()).toEqual([]);
    expect(useCommandLogStore.getState().handledIds).toEqual(new Set([31]));
  });

  it('reports a failure the operation does not recognize as an error', async () => {
    const { result, command } = startOperation({ onFailure: () => false });

    command.reject(new Error('boom'));
    await result;

    expect(toasts()).toMatchObject([{ kind: 'error', title: 'Updating workspace failed' }]);
  });
});

describe('runOperation when cancelled', () => {
  it('asks main once to stop it, and turns Cancel into a disabled "Stopping…"', () => {
    const { id } = startOperation();

    card()?.action?.run();
    card()?.action?.run();

    expect(uvcs.calls).toEqual([{ method: 'system.cancelOperation', args: [id()] }]);
    expect(card()?.action).toMatchObject({ label: 'Stopping…', disabled: true });
  });

  it('says it was stopped rather than that it failed', async () => {
    const { result, command } = startOperation();
    card()?.action?.run();

    command.reject(new Error('killed'));

    await expect(result).resolves.toBeUndefined();
    expect(toasts()).toMatchObject([{ kind: 'info', title: 'Stopped', detail: 'Updating workspace was stopped.' }]);
  });
});

describe('an update or a switch runs alone on its workspace', () => {
  it('does not start an update while another operation runs there, and says why', async () => {
    startOperation({ title: 'Checking in' });
    const run = vi.fn(async () => 'never');

    const result = await runOperation({ title: 'Updating workspace', workspacePath: ws, kind: 'update', run });

    expect(result).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
    expect(toasts().at(-1)).toMatchObject({ kind: 'info', title: 'Checking in is still running' });
  });

  it('keeps any other operation from starting while a switch runs there', async () => {
    startOperation({ title: 'Switching to /main/task', kind: 'switch' });
    const run = vi.fn(async () => 'never');

    await runOperation({ title: 'Checking in', workspacePath: ws, run });

    expect(run).not.toHaveBeenCalled();
  });

  it('lets other operations run side by side, and operations on other workspaces run', async () => {
    startOperation({ title: 'Checking in' });
    startOperation({ title: 'Updating workspace', workspacePath: '/work/other', kind: 'update' });

    const run = vi.fn(async () => 'shelved');
    await runOperation({ title: 'Shelving', workspacePath: ws, run });

    expect(run).toHaveBeenCalled();
  });

  it('is what refuseWhileBusy checks before asking anything about an update or a switch', () => {
    expect(refuseWhileBusy(ws)).toBe(false);
    startOperation({ title: 'Checking in' });

    expect(refuseWhileBusy(ws)).toBe(true);
    expect(refuseWhileBusy(ws, false)).toBe(false);
  });
});

describe('runAction', () => {
  it('resolves with the result and refreshes the views it affects', async () => {
    await expect(runAction(ws, "Couldn't rename", async () => 'renamed', affectsBranches)).resolves.toBe('renamed');

    expect(refreshed).toHaveBeenCalledWith(ws, affectsBranches);
  });

  it('shows the failure as an error toast, resolves undefined, and still refreshes', async () => {
    const result = await runAction(ws, "Couldn't rename", async () => Promise.reject(new Error('Name taken')));

    expect(result).toBeUndefined();
    expect(toasts()).toMatchObject([{ kind: 'error', title: "Couldn't rename", detail: 'Name taken' }]);
    expect(refreshed).toHaveBeenCalledWith(ws, undefined);
  });
});

describe('runVoidAction', () => {
  it('tells a successful void action from a failed one', async () => {
    await expect(runVoidAction(ws, 'Failed', async () => {})).resolves.toBe(true);
    await expect(runVoidAction(ws, 'Failed', async () => Promise.reject(new Error('no')))).resolves.toBe(false);
  });
});

describe('runRead', () => {
  it('reports a failure but refreshes nothing: a read changes nothing', async () => {
    await expect(runRead('Couldn’t open the file', async () => 'text')).resolves.toBe('text');
    await expect(runRead('Couldn’t open the file', async () => Promise.reject(new Error('gone')))).resolves.toBeUndefined();

    expect(toasts()).toMatchObject([{ kind: 'error', title: 'Couldn’t open the file', detail: 'gone' }]);
    expect(refreshed).not.toHaveBeenCalled();
  });
});
