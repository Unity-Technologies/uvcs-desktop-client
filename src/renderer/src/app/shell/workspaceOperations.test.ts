import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingSummary } from '@shared/domain/incoming';
import type { PendingChangesOnSwitch, SwitchPreflight } from '@shared/domain/switchWithChanges';

vi.mock('../../features/branches/SwitchWithChangesDialog', () => ({ askSwitchWithChanges: vi.fn() }));
vi.mock('../../features/incoming/useIncomingSummary', () => ({ recheckIncoming: vi.fn() }));
vi.mock('../../features/incoming/updateOperations', () => ({ explainUpdateConflicts: vi.fn(() => false), showUpdatedMoment: vi.fn() }));

import { askSwitchWithChanges } from '../../features/branches/SwitchWithChangesDialog';
import { explainUpdateConflicts, showUpdatedMoment } from '../../features/incoming/updateOperations';
import { recheckIncoming } from '../../features/incoming/useIncomingSummary';
import { shownToasts } from '../../testing/operationOutcome';
import { useToastStore } from '../../ui/toast/toastStore';
import { useRunningOperationsStore } from '../operations/runningOperationsStore';
import { queryClient } from '../queryClient';
import { switchWorkspace, updateUnlessUpToDate } from './workspaceOperations';

const ws = '/ws';

const noChanges: SwitchPreflight = {
  sourceName: '/main',
  pendingCount: 0,
  privateCount: 0,
  unchangedCheckoutsOnly: false,
  inMerge: false,
  lockedPaths: [],
  leftShelveCount: 0,
};
const withChanges: SwitchPreflight = { ...noChanges, pendingCount: 3 };

/** Main answers the switch's questions: its preflight, the setting, and the switch itself (an `Error` fails it). */
function switchServer(preflight: SwitchPreflight | Error, setting: PendingChangesOnSwitch = 'ask', switchTo: unknown = { kind: 'switched' }): void {
  answerOrFail('workspaces.switchPreflight', preflight);
  fakeApi.answer('settings.get', () => ({ pendingChangesOnSwitch: setting }));
  answerOrFail('workspaces.switchTo', switchTo);
}

/** Answers `method` with `value`, or fails it when `value` is an `Error`. */
function answerOrFail(method: string, value: unknown): void {
  fakeApi.answer(method, () => {
    if (value instanceof Error) throw value;
    return value;
  });
}

/** The pending-changes action each switch was run with. */
function switchesRun(): unknown[] {
  return fakeApi.argsOf('workspaces.switchTo').map((args) => args[3]);
}

/** What the progress card offers while the switch runs, which ends as `switched`. */
function progressCardWhileSwitching(switched: unknown): { action?: string } {
  const card: { action?: string } = {};
  fakeApi.answer('workspaces.switchTo', () => {
    card.action = useToastStore.getState().toasts.find((toast) => toast.kind === 'progress')?.action?.label;
    return switched;
  });
  return card;
}

beforeEach(() => {
  useRunningOperationsStore.setState({ operations: [] });
});
afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

describe('switchWorkspace', () => {
  it('switches plainly when there is nothing to decide about pending changes', async () => {
    switchServer(noChanges);

    await expect(switchWorkspace(ws, 'br:/main/task', '/main/task')).resolves.toBe(true);

    expect(switchesRun()).toEqual([undefined]);
    expect(askSwitchWithChanges).not.toHaveBeenCalled();
    expect(shownToasts()).toContainEqual({ kind: 'success', title: 'Switched to /main/task' });
  });

  it('follows the setting without asking when it decided and the choice is possible', async () => {
    switchServer(withChanges, 'bring');

    await switchWorkspace(ws, 'br:/main/task', '/main/task');

    expect(switchesRun()).toEqual(['bring']);
    expect(askSwitchWithChanges).not.toHaveBeenCalled();
  });

  it('asks what to do with the changes, and switches with the answer', async () => {
    switchServer(withChanges, 'ask');
    vi.mocked(askSwitchWithChanges).mockResolvedValue('leave');

    await expect(switchWorkspace(ws, 'br:/main/task', '/main/task')).resolves.toBe(true);

    expect(askSwitchWithChanges).toHaveBeenCalledWith(expect.objectContaining({ targetName: '/main/task', preflight: withChanges, inMerge: false }));
    expect(switchesRun()).toEqual(['leave']);
  });

  it('does not switch when the user cancels the question', async () => {
    switchServer(withChanges, 'ask');
    vi.mocked(askSwitchWithChanges).mockResolvedValue(undefined);

    await expect(switchWorkspace(ws, 'br:/main/task', '/main/task')).resolves.toBe(false);

    expect(switchesRun()).toEqual([]);
  });

  it('explains that an unfinished merge blocks the switch, whatever the setting', async () => {
    switchServer({ ...withChanges, inMerge: true }, 'leave');
    vi.mocked(askSwitchWithChanges).mockResolvedValue(undefined);

    await switchWorkspace(ws, 'br:/main/task', '/main/task');

    expect(askSwitchWithChanges).toHaveBeenCalledWith(expect.objectContaining({ inMerge: true }));
    expect(switchesRun()).toEqual([]);
  });

  it('skips the question when the caller already asked', async () => {
    switchServer(withChanges);

    await switchWorkspace(ws, 'br:/main/task', '/main/task', 'bring');

    expect(fakeApi.methods()).not.toContain('workspaces.switchPreflight');
    expect(switchesRun()).toEqual(['bring']);
  });

  it('reports a preflight that failed and does not switch', async () => {
    switchServer(new Error('The server is down'));

    await expect(switchWorkspace(ws, 'br:/main/task', '/main/task')).resolves.toBe(false);

    expect(switchesRun()).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't switch to /main/task", detail: 'The server is down' }]);
  });

  it('reports a switch that failed', async () => {
    switchServer(noChanges, 'ask', new Error('Merge needed'));

    await expect(switchWorkspace(ws, 'br:/main/task', '/main/task')).resolves.toBe(false);

    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Switching to /main/task failed', detail: 'Merge needed' }]);
  });

  it('can be stopped while no changes are shelved for it', async () => {
    switchServer(noChanges);
    const card = progressCardWhileSwitching({ kind: 'switched' });

    await switchWorkspace(ws, 'br:/main/task', '/main/task');

    expect(card.action).toBe('Cancel');
  });

  it('cannot be stopped once changes are shelved for it: they would be left in limbo', async () => {
    switchServer(withChanges);
    const card = progressCardWhileSwitching({ kind: 'brought' });

    await switchWorkspace(ws, 'br:/main/task', '/main/task', 'bring');

    expect(card.action).toBeUndefined();
  });

  it('refuses without asking the server while an update runs on the workspace', async () => {
    useRunningOperationsStore.getState().start({ id: 'u', workspacePath: ws, kind: 'update', title: 'Updating workspace' });

    await expect(switchWorkspace(ws, 'br:/main/task', '/main/task')).resolves.toBe(false);

    expect(fakeApi.calls()).toEqual([]);
    expect(shownToasts()).toEqual([expect.objectContaining({ kind: 'info', title: 'Updating workspace is still running' })]);
  });
});

describe('updateUnlessUpToDate', () => {
  const summary = (changesetCount: number): IncomingSummary => ({ branch: '/main', changesetCount }) as IncomingSummary;

  it('says the workspace is up to date instead of updating when the server has nothing new', async () => {
    vi.mocked(recheckIncoming).mockResolvedValue(summary(0));

    await updateUnlessUpToDate(ws);

    expect(fakeApi.methods()).not.toContain('workspaces.update');
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Already up to date', detail: 'Your workspace has everything on main.' }]);
  });

  it('updates and shows what came when there is something new', async () => {
    vi.mocked(recheckIncoming).mockResolvedValue(summary(2));
    fakeApi.answer('workspaces.update', () => undefined);

    await updateUnlessUpToDate(ws);

    expect(fakeApi.methods()).toContain('workspaces.update');
    expect(showUpdatedMoment).toHaveBeenCalledWith(ws, summary(2));
  });

  it('still updates when the server could not be asked first', async () => {
    vi.mocked(recheckIncoming).mockRejectedValue(new Error('offline'));
    fakeApi.answer('workspaces.update', () => undefined);

    await updateUnlessUpToDate(ws);

    expect(fakeApi.methods()).toContain('workspaces.update');
    expect(showUpdatedMoment).not.toHaveBeenCalled();
  });

  it('shows nothing updated when the update failed on conflicts it explained', async () => {
    vi.mocked(recheckIncoming).mockResolvedValue(summary(2));
    vi.mocked(explainUpdateConflicts).mockReturnValueOnce(true);
    fakeApi.answer('workspaces.update', () => {
      throw new Error('conflicts');
    });

    await updateUnlessUpToDate(ws);

    expect(showUpdatedMoment).not.toHaveBeenCalled();
    expect(shownToasts()).toEqual([]);
  });
});
