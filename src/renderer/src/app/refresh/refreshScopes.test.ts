import { describe, expect, it } from 'vitest';
import {
  isAffectedByFileChanges,
  isAffectedByFileChangesIn,
  isAffectedByLoadedChangeset,
  isAffectedByMovedPaths,
  isAffectedByAttributes,
  isAffectedByBranchList,
  isAffectedByLabels,
  isAffectedByNewChangesets,
  isAffectedByCheckinOrUpdate,
  isAffectedByShelving,
  isAffectedByShelvingAway,
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
    expect(isAffectedByNewChangesets(key('attributeValues', 'br:/main/task'))).toBe(false);
    expect(isAffectedByNewChangesets(key('codeReviews', { scope: 'all' }))).toBe(false);
    expect(isAffectedByNewChangesets(key('annotate', 'src/a.ts', undefined))).toBe(false);
    expect(isAffectedByNewChangesets(key('history', 'src/a.ts'))).toBe(true);
  });

  it("refreshes after this workspace's checkin or update all but the objects they leave alone", () => {
    expect(isAffectedByCheckinOrUpdate(key('pendingChanges'))).toBe(true);
    expect(isAffectedByCheckinOrUpdate(key('info'))).toBe(true);
    expect(isAffectedByCheckinOrUpdate(key('incoming', 'summary', { branch: '/main', loadedChangeset: 4 }))).toBe(true);
    expect(isAffectedByCheckinOrUpdate(key('changesets', {}))).toBe(true);
    expect(isAffectedByCheckinOrUpdate(key('leftChanges', { kind: 'branch', name: '/main' }))).toBe(false);
    expect(isAffectedByCheckinOrUpdate(key('labels', {}))).toBe(false);
    expect(isAffectedByCheckinOrUpdate(key('shelves', { owner: 'me' }))).toBe(false);
    expect(isAffectedByCheckinOrUpdate(key('changesets', 'byId', 4))).toBe(false);
  });

  it('refreshes only the shelve lists after shelving changes that stay in the workspace', () => {
    expect(isAffectedByShelving(key('shelves', { owner: 'me' }))).toBe(true);
    expect(isAffectedByShelving(key('pendingChanges'))).toBe(false);
    expect(isAffectedByShelving(key('info'))).toBe(false);
  });

  it('refreshes the shelve lists and the workspace, not the repository, after shelving changes away', () => {
    expect(isAffectedByShelvingAway(key('shelves', { owner: 'me' }))).toBe(true);
    expect(isAffectedByShelvingAway(key('pendingChanges'))).toBe(true);
    expect(isAffectedByShelvingAway(key('explorer', 'allPaths'))).toBe(true);
    expect(isAffectedByShelvingAway(key('diffContents', { kind: 'workspaceFile', path: 'a.txt' }))).toBe(true);
    expect(isAffectedByShelvingAway(key('changesets', {}))).toBe(false);
    expect(isAffectedByShelvingAway(key('leftChanges', 'br:/main'))).toBe(false);
  });

  it('refreshes the branch lists and the Branch Explorer when a branch is created, deleted or hidden', () => {
    expect(isAffectedByBranchList(key('branches', {}))).toBe(true);
    expect(isAffectedByBranchList(key('branchExplorer', { sinceDate: '2026-08-26' }))).toBe(true);
    expect(isAffectedByBranchList(key('pendingChanges'))).toBe(false);
    expect(isAffectedByBranchList(key('leftChanges', { kind: 'branch', name: '/main' }))).toBe(false);
  });

  it('refreshes the labels, the graph and the workspace info when a label changes, not the branches or the history', () => {
    expect(isAffectedByLabels(key('labels', {}))).toBe(true);
    expect(isAffectedByLabels(key('branchExplorer', {}))).toBe(true);
    expect(isAffectedByLabels(key('info'))).toBe(true);
    expect(isAffectedByLabels(key('branches', {}))).toBe(false);
    expect(isAffectedByLabels(key('changesets', 'list', {}))).toBe(false);
  });

  it('refreshes only the attributes when an attribute or a value changes', () => {
    expect(isAffectedByAttributes(key('attributeTypes'))).toBe(true);
    expect(isAffectedByAttributes(key('attributeValues', 'br:/main'))).toBe(true);
    expect(isAffectedByAttributes(key('attributeUsedValues', 'status'))).toBe(true);
    expect(isAffectedByAttributes(key('branches', {}))).toBe(false);
    expect(isAffectedByAttributes(key('info'))).toBe(false);
  });

  it('re-reads only the listings and details a change in some folders touches', () => {
    const inDeep = isAffectedByFileChangesIn(['src/deep']);
    expect(inDeep(key('explorer', 'directory', 'src/deep'))).toBe(true);
    expect(inDeep(key('explorer', 'directory', 'src'))).toBe(true);
    expect(inDeep(key('explorer', 'directory', ''))).toBe(true);
    expect(inDeep(key('explorer', 'directory', 'src/deeper'))).toBe(false);
    expect(inDeep(key('explorer', 'directory', 'src/deep/inner'))).toBe(false);
    expect(inDeep(key('explorer', 'directory', 'docs'))).toBe(false);
    expect(inDeep(key('explorer', 'details', 'src/deep/a.ts'))).toBe(true);
    expect(inDeep(key('explorer', 'details', 'src'))).toBe(true);
    expect(inDeep(key('explorer', 'details', 'docs/a.md'))).toBe(false);
    expect(inDeep(key('explorer', 'allPaths'))).toBe(false);
    expect(inDeep(key('pendingChanges', 'all'))).toBe(true);
    expect(isAffectedByFileChangesIn([''])(key('explorer', 'details', 'readme.md'))).toBe(true);
    expect(isAffectedByFileChangesIn(null)(key('explorer', 'directory', 'docs'))).toBe(true);
  });
});
