import { fakeApi } from '../../testing/fakeWindow';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startingWorkspaceQuery } from '@shared/startingWorkspace';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));
vi.mock('../home/dialogs/CreateWorkspaceDialog', () => ({ openCreateWorkspaceDialog: vi.fn() }));

import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { useNavigation } from '../navigation/navigationStore';
import { queryClient } from '../queryClient';
import { openFolder } from './openWorkspaceFolder';
import { openWorkspaceFromAddress } from './openWorkspaceFromAddress';
import { useSession } from './sessionStore';
import { openUnlessShownElsewhere } from './useOpenWorkspace';

afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

describe('openUnlessShownElsewhere', () => {
  it('brings forward the window that already shows the workspace instead of opening it twice', async () => {
    fakeApi.answer('windows.focusWorkspace', () => true);
    const open = vi.fn();

    await openUnlessShownElsewhere('/ws', open);

    expect(open).not.toHaveBeenCalled();
    expect(fakeApi.methods()).toEqual(['windows.focusWorkspace']);
  });

  it('opens the workspace on its Changes view and remembers it as recent', async () => {
    fakeApi.answer('windows.focusWorkspace', () => false);
    fakeApi.answer('settings.rememberRecentWorkspace', () => undefined);
    fakeApi.answer('system.addRecentDocument', () => undefined);
    useNavigation.setState({ view: 'branches', pages: [] });
    const open = vi.fn();

    await openUnlessShownElsewhere('/ws', open);

    expect(open).toHaveBeenCalledWith('/ws');
    expect(useNavigation.getState().view).toBe('changes');
    expect(fakeApi.calls()).toContainEqual({ method: 'settings.rememberRecentWorkspace', args: ['/ws'] });
    expect(fakeApi.calls()).toContainEqual({ method: 'system.addRecentDocument', args: ['/ws'] });
  });
});

describe('a window reopened on a view after an update', () => {
  afterEach(() => {
    useSession.setState({ workspacePath: null });
    useNavigation.setState({ view: 'changes', pages: [] });
  });

  it("keeps the view once the main process's request for its workspace comes, which only remembers it as recent", async () => {
    fakeApi.answer('windows.focusWorkspace', () => false);
    fakeApi.answer('settings.rememberRecentWorkspace', () => undefined);
    fakeApi.answer('system.addRecentDocument', () => undefined);
    const location = { search: `?${new URLSearchParams(startingWorkspaceQuery('/ws', 'branchExplorer'))}`, pathname: '/index.html' };
    // Replacing the address drops its query, as a browser does.
    openWorkspaceFromAddress({ location, history: { replaceState: () => void (location.search = '') } });

    await openUnlessShownElsewhere('/ws', useSession.getState().openWorkspace);

    expect(useNavigation.getState().view).toBe('branchExplorer');
    expect(fakeApi.calls()).toContainEqual({ method: 'settings.rememberRecentWorkspace', args: ['/ws'] });
  });
});

describe('openFolder', () => {
  it('opens the workspace the folder belongs to', async () => {
    fakeApi.answer('workspaces.findRoot', () => '/ws');
    const open = vi.fn();

    await openFolder('/ws/Assets/Art', open);

    expect(open).toHaveBeenCalledWith('/ws');
    expect(askedDialogs()).toEqual([]);
  });

  it('offers to create a workspace in a folder that is none', async () => {
    fakeApi.answer('workspaces.findRoot', () => null);
    const open = vi.fn();

    await openFolder('/projects/new', open);

    expect(openCreateWorkspaceDialog).toHaveBeenCalledWith({ path: '/projects/new', onCreated: open });
    expect(open).not.toHaveBeenCalled();
  });

  it('does nothing when the user declines creating one', async () => {
    fakeApi.answer('workspaces.findRoot', () => null);
    answerConfirms(false);

    await openFolder('/projects/new', vi.fn());

    expect(openCreateWorkspaceDialog).not.toHaveBeenCalled();
  });
});
