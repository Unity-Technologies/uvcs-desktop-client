import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../home/dialogs/CreateWorkspaceDialog', () => ({ openCreateWorkspaceDialog: vi.fn() }));

import { useToastStore } from '../../ui/toast/toastStore';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { openDroppedFolder } from './openDroppedFolder';

afterEach(() => {
  vi.clearAllMocks();
  useToastStore.setState({ toasts: [] });
});

const folder = (path: string) => ({ kind: 'folder', path }) as const;

function target(overrides: { newWindow?: boolean; currentWorkspace?: string | null } = {}) {
  return { newWindow: false, currentWorkspace: null, openHere: vi.fn<(path: string) => void>(), ...overrides };
}

function toastTitles(): string[] {
  return useToastStore.getState().toasts.map((toast) => toast.title);
}

describe('openDroppedFolder', () => {
  it('opens the workspace a dropped folder belongs to in this window', async () => {
    fakeApi.answer('workspaces.findRoot', () => '/ws');
    const here = target();

    await openDroppedFolder(folder('/ws/Assets'), here);

    expect(here.openHere).toHaveBeenCalledWith('/ws');
    expect(fakeApi.calls()).toEqual([{ method: 'workspaces.findRoot', args: ['/ws/Assets'] }]);
  });

  it('opens it in a new window when Shift was held', async () => {
    fakeApi.answer('workspaces.findRoot', () => '/ws');
    fakeApi.answer('windows.openWorkspace', () => undefined);
    const here = target({ newWindow: true, currentWorkspace: '/other' });

    await openDroppedFolder(folder('/ws'), here);

    expect(here.openHere).not.toHaveBeenCalled();
    expect(fakeApi.calls()).toContainEqual({ method: 'windows.openWorkspace', args: ['/ws'] });
  });

  it('does nothing when the folder belongs to the workspace this window already shows', async () => {
    fakeApi.answer('workspaces.findRoot', () => '/ws');
    const here = target({ currentWorkspace: '/ws' });

    await openDroppedFolder(folder('/ws/Assets'), here);

    expect(here.openHere).not.toHaveBeenCalled();
  });

  it('offers to create a workspace in a folder that is none, opening it here once created', async () => {
    fakeApi.answer('workspaces.findRoot', () => null);
    const here = target();

    await openDroppedFolder(folder('/projects/new'), here);

    expect(openCreateWorkspaceDialog).toHaveBeenCalledWith({ path: '/projects/new', onCreated: here.openHere });
    expect(here.openHere).not.toHaveBeenCalled();
  });

  it('opens the created workspace in a new window when Shift was held', async () => {
    fakeApi.answer('workspaces.findRoot', () => null);
    fakeApi.answer('windows.openWorkspace', () => undefined);

    await openDroppedFolder(folder('/projects/new'), target({ newWindow: true }));
    const [[{ onCreated }]] = vi.mocked(openCreateWorkspaceDialog).mock.calls as [[{ onCreated: (path: string) => void }]];
    onCreated('/projects/new');

    expect(fakeApi.calls()).toContainEqual({ method: 'windows.openWorkspace', args: ['/projects/new'] });
  });

  it('tells the user a drop takes one folder, without asking cm anything', async () => {
    await openDroppedFolder({ kind: 'notAFolder' }, target());
    await openDroppedFolder({ kind: 'severalItems' }, target());

    expect(toastTitles()).toEqual(['Drop a folder', 'Drop one folder at a time']);
    expect(fakeApi.calls()).toEqual([]);
    expect(openCreateWorkspaceDialog).not.toHaveBeenCalled();
  });
});
