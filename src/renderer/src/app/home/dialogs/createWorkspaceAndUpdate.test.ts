import { commandFailure, fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import type { CreateWorkspaceRequest } from '@shared/api/workspaces';
import { queryKeys } from '../../../api/queryKeys';
import { shownToasts, watchRefreshes, type WorkspaceArea } from '../../../testing/operationOutcome';
import { queryClient } from '../../queryClient';
import { createWorkspaceAndUpdate } from './createWorkspaceAndUpdate';

const request: CreateWorkspaceRequest = { name: 'game', path: '/Users/me/wkspaces/game', repository: 'game@local' };
const created = { name: 'game', path: request.path, guid: 'g' };

/** What an update changes: the workspace and what it has loaded, never the labels, shelves, attributes, reviews or left changes. */
const REFRESHED_BY_UPDATE: WorkspaceArea[] = ['annotate', 'branchExplorer', 'branches', 'changesets', 'explorer', 'history', 'incoming', 'info', 'locks', 'pendingChanges', 'review'];

describe('createWorkspaceAndUpdate', () => {
  it('creates the workspace, opens it, then updates it to the latest files with the Update progress card', async () => {
    const open = vi.fn();
    const shownWhileUpdating: { opened?: boolean; card?: string } = {};
    fakeApi.answer('workspaces.create', () => created);
    fakeApi.answer('workspaces.update', () => {
      shownWhileUpdating.opened = open.mock.calls.length > 0;
      shownWhileUpdating.card = shownToasts().find((toast) => toast.kind === 'progress')?.title;
    });

    await createWorkspaceAndUpdate(request, open);

    expect(fakeApi.methods()).toEqual(['workspaces.create', 'workspaces.update']);
    expect(fakeApi.argsOf('workspaces.create')).toEqual([[request]]);
    expect(fakeApi.argsOf('workspaces.update')).toEqual([[request.path, expect.any(String)]]);
    expect(open).toHaveBeenCalledWith(request.path);
    expect(shownWhileUpdating).toEqual({ opened: true, card: 'Updating workspace' });
    expect(shownToasts()).toEqual([{ kind: 'success', title: 'Workspace is up to date' }]);
  });

  it('refreshes the workspace list, and in the new workspace what an update changes', async () => {
    fakeApi.answer('workspaces.create', () => created);
    fakeApi.answer('workspaces.update', () => undefined);
    queryClient.setQueryData(queryKeys.workspaces, []);
    const refreshed = watchRefreshes(request.path);

    await createWorkspaceAndUpdate(request, () => {});

    expect(queryClient.getQueryState(queryKeys.workspaces)?.isInvalidated).toBe(true);
    expect(refreshed()).toEqual(REFRESHED_BY_UPDATE);
  });

  it('keeps the workspace created and open when the update fails, and says the update failed', async () => {
    const open = vi.fn();
    fakeApi.answer('workspaces.create', () => created);
    fakeApi.answer('workspaces.update', () => {
      throw commandFailure('Server unreachable');
    });

    await createWorkspaceAndUpdate(request, open);

    expect(open).toHaveBeenCalledWith(request.path);
    expect(fakeApi.methods()).toEqual(['workspaces.create', 'workspaces.update']);
    expect(shownToasts()).toEqual([{ kind: 'error', title: 'Updating workspace failed', detail: 'Server unreachable' }]);
  });

  it('neither opens nor updates a workspace it could not create, and lets the caller tell the user', async () => {
    const open = vi.fn();
    fakeApi.answer('workspaces.create', () => {
      throw commandFailure('The workspace name is already in use');
    });

    await expect(createWorkspaceAndUpdate(request, open)).rejects.toThrow('The workspace name is already in use');

    expect(open).not.toHaveBeenCalled();
    expect(fakeApi.methods()).toEqual(['workspaces.create']);
  });
});
