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
const summary = (changesetCount: number, branch = '/main'): IncomingSummary => ({ branch, loadedChangeset: 11, headChangeset: 11 + changesetCount, changesetCount, authors: [] });

describe('workspaceContext', () => {
  it('tells the loaded changeset and keeps its branch for the tooltip', () => {
    expect(workspaceContext(info({ kind: 'branch', name: '/main/task' }), undefined)).toEqual({
      changeset: 'cs:11',
      description: 'cs:11 on /main/task',
      repository: 'game@local',
      sync: null,
    });
  });

  it('tells whether the branch moved on', () => {
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), summary(0)).sync).toEqual({ kind: 'upToDate', label: 'Up to date', tip: 'Nothing new on /main' });
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), summary(3)).sync).toEqual({
      kind: 'behind',
      count: 3,
      label: '3 incoming',
      tip: '3 new changesets on /main: review them in Incoming',
    });
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), summary(1)).sync?.tip).toBe('1 new changeset on /main: review them in Incoming');
  });

  it('leaves the sync state out while unknown or checked for another branch', () => {
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), undefined).sync).toBeNull();
    expect(workspaceContext(info({ kind: 'branch', name: '/main/task' }), summary(2)).sync).toBeNull();
  });

  it('names labels and shelves next to the changeset, and a changeset once', () => {
    expect(workspaceContext(info({ kind: 'label', name: 'v1.0' }), undefined).description).toBe('cs:11 · Label v1.0');
    expect(workspaceContext(info({ kind: 'shelve', name: '3' }), undefined).description).toBe('cs:11 · Shelve sh:3');
    expect(workspaceContext(info({ kind: 'changeset', name: '11' }), summary(0))).toMatchObject({ changeset: 'cs:11', description: 'cs:11', sync: null });
  });
});
