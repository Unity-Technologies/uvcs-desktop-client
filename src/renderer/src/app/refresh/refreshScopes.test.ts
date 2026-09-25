import { describe, expect, it } from 'vitest';
import {
  isAffectedByFileChanges,
  isAffectedByLoadedChangeset,
  isAffectedByMovedPaths,
  isAffectedByNewChangesets,
  isAffectedByOwnCheckin,
  isAffectedByWorkspaceState,
} from './refreshScopes';

const key = (...parts: unknown[]) => ['workspace', '/ws', ...parts];

describe('refresh scopes', () => {
  it('refreshes what shows the disk on file changes, not immutable revisions', () => {
    expect(isAffectedByFileChanges(key('pendingChanges', 'all'))).toBe(true);
    expect(isAffectedByFileChanges(key('explorer', 'directory', 'src'))).toBe(true);
    expect(isAffectedByFileChanges(key('content', { kind: 'workspaceFile', path: 'a.txt' }))).toBe(true);
    expect(isAffectedByFileChanges(key('content', { kind: 'revision', revisionId: 4 }))).toBe(false);
    expect(isAffectedByFileChanges(key('diffContents', { kind: 'workspaceBase', path: 'a.txt' }, { kind: 'workspaceFile', path: 'a.txt' }))).toBe(true);
    expect(isAffectedByFileChanges(key('diffContents', { kind: 'revision', revisionId: 3 }, { kind: 'revision', revisionId: 4 }))).toBe(false);
    expect(isAffectedByFileChanges(key('review'))).toBe(true);
    expect(isAffectedByFileChanges(key('explorer', 'allPaths'))).toBe(false);
    expect(isAffectedByFileChanges(key('branchExplorer', {}))).toBe(false);
  });

  it('re-reads every path only when items come or go', () => {
    expect(isAffectedByMovedPaths(key('explorer', 'allPaths'))).toBe(true);
    expect(isAffectedByMovedPaths(key('pendingChanges'))).toBe(false);
  });

  it('refreshes the pending changes and info on .plastic rewrites, everything else when the loaded changeset moves', () => {
    expect(isAffectedByWorkspaceState(key('info'))).toBe(true);
    expect(isAffectedByWorkspaceState(key('history', 'a.txt'))).toBe(false);
    expect(isAffectedByLoadedChangeset(key('history', 'a.txt'))).toBe(true);
    expect(isAffectedByLoadedChangeset(key('info'))).toBe(false);
  });

  it('refreshes repository views on new changesets, but not the disk or the incoming check itself', () => {
    expect(isAffectedByNewChangesets(key('branchExplorer', {}))).toBe(true);
    expect(isAffectedByNewChangesets(key('incoming', 'changes'))).toBe(true);
    expect(isAffectedByNewChangesets(key('incoming', 'summary'))).toBe(false);
    expect(isAffectedByNewChangesets(key('pendingChanges'))).toBe(false);
    expect(isAffectedByNewChangesets(key('content', { kind: 'revision' }))).toBe(false);
  });

  it('leaves the lists of objects checkins do not create alone on new changesets', () => {
    expect(isAffectedByNewChangesets(key('branches', {}))).toBe(true);
    expect(isAffectedByNewChangesets(key('changesets', {}))).toBe(true);
    expect(isAffectedByNewChangesets(key('labels', {}))).toBe(false);
    expect(isAffectedByNewChangesets(key('shelves', {}))).toBe(false);
    expect(isAffectedByNewChangesets(key('attributeTypes'))).toBe(false);
    expect(isAffectedByNewChangesets(key('codeReviews', { scope: 'all' }))).toBe(false);
  });

  it("refreshes after this workspace's checkin all but the objects a checkin leaves alone", () => {
    expect(isAffectedByOwnCheckin(key('pendingChanges'))).toBe(true);
    expect(isAffectedByOwnCheckin(key('info'))).toBe(true);
    expect(isAffectedByOwnCheckin(key('incoming', 'summary', { branch: '/main', loadedChangeset: 4 }))).toBe(true);
    expect(isAffectedByOwnCheckin(key('changesets', {}))).toBe(true);
    expect(isAffectedByOwnCheckin(key('leftChanges', { kind: 'branch', name: '/main' }))).toBe(false);
    expect(isAffectedByOwnCheckin(key('labels', {}))).toBe(false);
    expect(isAffectedByOwnCheckin(key('shelves', { owner: 'me' }))).toBe(false);
  });
});
