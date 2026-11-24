import { describe, expect, it } from 'vitest';
import type { IncomingSummary } from '@shared/domain/incoming';
import type { WorkspaceInfo, WorkspaceSelector } from '@shared/domain/workspace';
import { workspaceContext } from './workspaceContext';

const info = (selector: WorkspaceSelector, loadedChangeset: number | null = 11): WorkspaceInfo => ({
  name: 'game',
  path: '/work/game',
  repository: 'game@local',
  repositoryName: 'game',
  server: 'local',
  selector,
  loadedChangeset,
  kind: 'standard',
});
const summary = (changesetCount: number, branch = '/main', countCapped = false): IncomingSummary => ({
  branch,
  loadedChangeset: 11,
  headChangeset: 11 + changesetCount,
  changesetCount,
  countCapped,
  authors: [],
});

describe('workspaceContext', () => {
  it('tells the loaded changeset and keeps its branch for the tooltip', () => {
    expect(workspaceContext(info({ kind: 'branch', name: '/main/task' }), undefined)).toEqual({
      changeset: { id: 11, spec: 'cs:11', description: 'cs:11 on /main/task' },
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

  it('says 100+ once the incoming check stopped counting', () => {
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), summary(100, '/main', true)).sync).toEqual({
      kind: 'behind',
      count: 100,
      label: '100+ incoming',
      tip: '100+ new changesets on /main: review them in Incoming',
    });
  });

  it('counts the items the branch head brings a partial workspace, which loads no one changeset', () => {
    const partial = (itemCount: number): IncomingSummary => ({ branch: '/main', partial: true, headChangeset: 20, itemCount });
    const onMain = info({ kind: 'branch', name: '/main' }, null);

    expect(workspaceContext(onMain, partial(2))).toEqual({
      changeset: null,
      repository: 'game@local',
      sync: { kind: 'behind', count: 2, label: '2 incoming', tip: '2 items changed on /main: review them in Incoming' },
    });
    expect(workspaceContext(onMain, partial(0)).sync).toEqual({ kind: 'upToDate', label: 'Up to date', tip: 'Nothing new on /main' });
    expect(workspaceContext(onMain, undefined).sync).toBeNull();
  });

  it('leaves the sync state out while unknown or checked for another branch', () => {
    expect(workspaceContext(info({ kind: 'branch', name: '/main' }), undefined).sync).toBeNull();
    expect(workspaceContext(info({ kind: 'branch', name: '/main/task' }), summary(2)).sync).toBeNull();
  });

  it('names labels next to the changeset, and a changeset once', () => {
    expect(workspaceContext(info({ kind: 'label', name: 'v1.0' }), undefined).changeset?.description).toBe('cs:11 · Label v1.0');
    expect(workspaceContext(info({ kind: 'changeset', name: '11' }), summary(0))).toMatchObject({ changeset: { spec: 'cs:11', description: 'cs:11' }, sync: null });
  });

  it('shows no changeset on a shelve, whose tree is none', () => {
    expect(workspaceContext(info({ kind: 'shelve', name: '3' }, null), undefined)).toEqual({ changeset: null, repository: 'game@local', sync: null });
  });
});
