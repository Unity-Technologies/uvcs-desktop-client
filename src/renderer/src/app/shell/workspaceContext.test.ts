import { describe, expect, it } from 'vitest';
import type { IncomingSummary } from '@shared/domain/incoming';
import type { WorkspaceInfo, WorkspaceSelector } from '@shared/domain/workspace';
import { workspaceContext } from './workspaceContext';

const info = (selector: WorkspaceSelector, loadedChangeset = 11): WorkspaceInfo => ({
  name: 'game',
  path: '/work/game',
  repository: 'game@local',
  repositoryName: 'game',
  server: 'local',
  selector,
  loadedChangeset,
});
const summary = (changesetCount: number, branch = '/main'): IncomingSummary => ({ branch, loadedChangeset: 11, headChangeset: 11 + changesetCount, changesetCount });

describe('workspaceContext', () => {
  it('tells the loaded changeset, the branch and whether the branch moved on', () => {
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), summary(0))).toEqual({ position: 'cs:11 on', branch: '/main', sync: 'up to date', behind: 0 });
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), summary(3))).toEqual({ position: 'cs:11 on', branch: '/main', sync: '3 behind', behind: 3 });
  });

  it('leaves the sync state out while unknown or checked for another branch', () => {
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), undefined).sync).toBeNull();
    expect(workspaceContext(info({ kind: 'branch', name: '/main/task' }), summary(2)).sync).toBeNull();
  });

  it('names labels and shelves next to the changeset, and a changeset once', () => {
    expect(workspaceContext(info({ kind: 'label', name: 'v1.0' }), undefined).position).toBe('cs:11 · Label v1.0');
    expect(workspaceContext(info({ kind: 'shelve', name: '3' }), undefined).position).toBe('cs:11 · Shelve sh:3');
    expect(workspaceContext(info({ kind: 'changeset', name: '11' }), undefined)).toMatchObject({ position: 'cs:11', branch: null });
  });
});
