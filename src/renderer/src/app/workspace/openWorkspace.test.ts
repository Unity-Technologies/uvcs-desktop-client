import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const uvcs = await vi.hoisted(async () => (await import('../../lib/testing/fakeWindow')).installFakeWindow());

vi.mock('../../ui/dialog/confirm', () => ({ confirm: vi.fn() }));
vi.mock('../home/dialogs/CreateWorkspaceDialog', () => ({ openCreateWorkspaceDialog: vi.fn() }));

import { confirm } from '../../ui/dialog/confirm';
import { openCreateWorkspaceDialog } from '../home/dialogs/CreateWorkspaceDialog';
import { useNavigation } from '../navigation/navigationStore';
import { queryClient } from '../queryClient';
import { openFolder } from './openWorkspaceFolder';
import { openUnlessShownElsewhere } from './useOpenWorkspace';


beforeEach(() => {
  uvcs.reset();
});
afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

describe('openUnlessShownElsewhere', () => {
  it('brings forward the window that already shows the workspace instead of opening it twice', async () => {
    uvcs.answerWith({ 'windows.focusWorkspace': true });
    const open = vi.fn();

    await openUnlessShownElsewhere('/ws', open);

    expect(open).not.toHaveBeenCalled();
    expect(uvcs.methodsCalled()).toEqual(['windows.focusWorkspace']);
  });

  it('opens the workspace on its Changes view and remembers it as recent', async () => {
    uvcs.answerWith({ 'windows.focusWorkspace': false });
    useNavigation.setState({ view: 'branches', pages: [] });
    const open = vi.fn();

    await openUnlessShownElsewhere('/ws', open);

    expect(open).toHaveBeenCalledWith('/ws');
    expect(useNavigation.getState().view).toBe('changes');
    expect(uvcs.calls).toContainEqual({ method: 'settings.rememberRecentWorkspace', args: ['/ws'] });
    expect(uvcs.calls).toContainEqual({ method: 'system.addRecentDocument', args: ['/ws'] });
  });
});

describe('openFolder', () => {
  it('opens the workspace the folder belongs to', async () => {
    uvcs.answerWith({ 'workspaces.findRoot': '/ws' });
    const open = vi.fn();

    await openFolder('/ws/Assets/Art', open);

    expect(open).toHaveBeenCalledWith('/ws');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('offers to create a workspace in a folder that is none', async () => {
    uvcs.answerWith({ 'workspaces.findRoot': null });
    vi.mocked(confirm).mockResolvedValue(true);
    const open = vi.fn();

    await openFolder('/projects/new', open);

    expect(openCreateWorkspaceDialog).toHaveBeenCalledWith({ path: '/projects/new', onCreated: open });
    expect(open).not.toHaveBeenCalled();
  });

  it('does nothing when the user declines creating one', async () => {
    uvcs.answerWith({ 'workspaces.findRoot': null });
    vi.mocked(confirm).mockResolvedValue(false);

    await openFolder('/projects/new', vi.fn());

    expect(openCreateWorkspaceDialog).not.toHaveBeenCalled();
  });
});
