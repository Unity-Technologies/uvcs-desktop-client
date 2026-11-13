import { describe, expect, it } from 'vitest';
import {
  isAffectedByFileChanges,
  isAffectedByFileChangesIn,
  isAffectedByLoadedChangeset,
  isAffectedByMovedPaths,
  isAffectedByAttributes,
  isAffectedByBranchList,
  isAffectedByChangesetComment,
  withChangeRequestsApplied,
  isAffectedByChangesetMove,
  isAffectedByLabels,
  isAffectedByNewChangesets,
  isAffectedByCheckinOrUpdate,
  isAffectedByServerMerge,
  isAffectedByPendingChangeEdit,
  isAffectedByPermissions,
  isAffectedByRecordedMove,
  isAffectedByRestoredItems,
  isAffectedByShelveApplied,
  isAffectedByShelveDeletion,
  isAffectedByShelveComment,
  isAffectedByShelving,
  isAffectedByShelvingAway,
  isAffectedByWorkspaceState,
  isShownByCodeReviewPage,
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

  it('refreshes after a merge into a server branch what new changesets change and the incoming check, never the workspace', () => {
    expect(isAffectedByServerMerge(key('incoming', 'summary'))).toBe(true);
    expect(isAffectedByServerMerge(key('branchExplorer', {}))).toBe(true);
    expect(isAffectedByServerMerge(key('pendingChanges'))).toBe(false);
    expect(isAffectedByServerMerge(key('info'))).toBe(false);
    expect(isAffectedByServerMerge(key('labels', {}))).toBe(false);
  });

  it('leaves the lists of objects checkins do not create alone on new changesets', () => {
    expect(isAffectedByNewChangesets(key('branches', {}))).toBe(true);
    expect(isAffectedByNewChangesets(key('changesets', {}))).toBe(true);
    expect(isAffectedByNewChangesets(key('labels', {}))).toBe(false);
    expect(isAffectedByNewChangesets(key('shelves', {}))).toBe(false);
    expect(isAffectedByNewChangesets(key('attributeTypes'))).toBe(false);
    expect(isAffectedByNewChangesets(key('attributeValues', 'br:/main/task'))).toBe(false);
    expect(isAffectedByNewChangesets(key('codeReviews', {}))).toBe(false);
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
    expect(isAffectedByCheckinOrUpdate(key('shelves', { owners: ['me'] }))).toBe(false);
    expect(isAffectedByCheckinOrUpdate(key('changesets', 'byId', 4))).toBe(false);
  });

  it('refreshes the code reviews too after a check-in or a comment edit whose comment applies a change request', () => {
    const checkin = withChangeRequestsApplied(isAffectedByCheckinOrUpdate, 'Shelve first [apply-change:c0d1ce00]');
    expect(checkin(key('codeReviews', 'summaries', { targetBranch: '/main/task' }))).toBe(true);
    expect(checkin(key('codeReviews', 'conversation', 43))).toBe(true);
    expect(checkin(key('pendingChanges'))).toBe(true);
    expect(checkin(key('labels', {}))).toBe(false);
    expect(withChangeRequestsApplied(isAffectedByChangesetComment, 'Fixed [APPLY-CHANGE:C0D1CE00]')(key('codeReviews', {}))).toBe(true);
  });

  it('leaves the code reviews alone after a comment that applies none', () => {
    expect(withChangeRequestsApplied(isAffectedByCheckinOrUpdate, 'Shelve first, see cr:43 and [apply-change:c0d1ce0]')(key('codeReviews', {}))).toBe(false);
    expect(withChangeRequestsApplied(isAffectedByChangesetComment, 'Fixed')).toBe(isAffectedByChangesetComment);
  });

  it('refreshes only the shelve lists after shelving changes that stay in the workspace', () => {
    expect(isAffectedByShelving(key('shelves', { owners: ['me'] }))).toBe(true);
    expect(isAffectedByShelving(key('pendingChanges'))).toBe(false);
    expect(isAffectedByShelving(key('info'))).toBe(false);
  });

  it('refreshes the shelve lists and the workspace, not the repository, after shelving changes away', () => {
    expect(isAffectedByShelvingAway(key('shelves', { owners: ['me'] }))).toBe(true);
    expect(isAffectedByShelvingAway(key('pendingChanges'))).toBe(true);
    expect(isAffectedByShelvingAway(key('explorer', 'allPaths'))).toBe(true);
    expect(isAffectedByShelvingAway(key('diffContents', { kind: 'workspaceFile', path: 'a.txt' }))).toBe(true);
    expect(isAffectedByShelvingAway(key('changesets', {}))).toBe(false);
    expect(isAffectedByShelvingAway(key('leftChanges', 'br:/main'))).toBe(false);
  });

  it('refreshes the shelve lists and the left changes, nothing else, when shelves are deleted', () => {
    expect(isAffectedByShelveDeletion(key('shelves', { owners: ['me'] }))).toBe(true);
    expect(isAffectedByShelveDeletion(key('leftChanges', { kind: 'branch', name: '/main' }))).toBe(true);
    expect(isAffectedByShelveDeletion(key('pendingChanges'))).toBe(false);
    expect(isAffectedByShelveDeletion(key('branchExplorer', {}))).toBe(false);
  });

  it('refreshes the workspace, its locks, the shelve lists and the left changes, not the repository, when a shelve is applied', () => {
    expect(isAffectedByShelveApplied(key('pendingChanges'))).toBe(true);
    expect(isAffectedByShelveApplied(key('explorer', 'allPaths'))).toBe(true);
    expect(isAffectedByShelveApplied(key('locks', {}))).toBe(true);
    expect(isAffectedByShelveApplied(key('shelves', { owners: ['me'] }))).toBe(true);
    expect(isAffectedByShelveApplied(key('leftChanges', { kind: 'branch', name: '/main' }))).toBe(true);
    expect(isAffectedByShelveApplied(key('changesets', {}))).toBe(false);
    expect(isAffectedByShelveApplied(key('branchExplorer', {}))).toBe(false);
  });

  it('refreshes the workspace and its locks, not the repository, when files are added, checked out or undone', () => {
    expect(isAffectedByPendingChangeEdit(key('pendingChanges'))).toBe(true);
    expect(isAffectedByPendingChangeEdit(key('info'))).toBe(true);
    expect(isAffectedByPendingChangeEdit(key('explorer', 'allPaths'))).toBe(true);
    expect(isAffectedByPendingChangeEdit(key('locks', {}))).toBe(true);
    expect(isAffectedByPendingChangeEdit(key('shelves', { owners: ['me'] }))).toBe(false);
    expect(isAffectedByPendingChangeEdit(key('history', 'a.txt'))).toBe(false);
  });

  it('refreshes the workspace, not its locks nor the repository, when a move is recorded by hand', () => {
    expect(isAffectedByRecordedMove(key('pendingChanges'))).toBe(true);
    expect(isAffectedByRecordedMove(key('explorer', 'allPaths'))).toBe(true);
    expect(isAffectedByRecordedMove(key('locks', {}))).toBe(false);
    expect(isAffectedByRecordedMove(key('history', 'a.txt'))).toBe(false);
  });

  it('refreshes the workspace, not its locks nor the repository, when deleted items are restored', () => {
    expect(isAffectedByRestoredItems(key('pendingChanges'))).toBe(true);
    expect(isAffectedByRestoredItems(key('explorer', 'directory', 'src'))).toBe(true);
    expect(isAffectedByRestoredItems(key('explorer', 'allPaths'))).toBe(true);
    expect(isAffectedByRestoredItems(key('locks', {}))).toBe(false);
    expect(isAffectedByRestoredItems(key('changesets', {}))).toBe(false);
    expect(isAffectedByRestoredItems(key('history', 'a.txt'))).toBe(false);
  });

  it('refreshes only what shows a changeset comment when one is edited, the changesets already read too', () => {
    expect(isAffectedByChangesetComment(key('changesets', 'byId', 4))).toBe(true);
    expect(isAffectedByChangesetComment(key('history', 'a.txt'))).toBe(true);
    expect(isAffectedByChangesetComment(key('workingObjectComment', 'changeset', '4'))).toBe(true);
    expect(isAffectedByChangesetComment(key('branches', {}))).toBe(false);
    expect(isAffectedByChangesetComment(key('pendingChanges'))).toBe(false);
  });

  it("refreshes only what shows a shelve's comment when one is edited", () => {
    expect(isAffectedByShelveComment(key('shelves', { owners: ['me'] }))).toBe(true);
    expect(isAffectedByShelveComment(key('workingObjectComment', 'shelve', '3'))).toBe(true);
    expect(isAffectedByShelveComment(key('leftChanges', { kind: 'branch', name: '/main' }))).toBe(false);
    expect(isAffectedByShelveComment(key('changesets', 'list', {}))).toBe(false);
    expect(isAffectedByShelveComment(key('pendingChanges'))).toBe(false);
  });

  it('refreshes what shows changesets, the branch lists and incoming, not the workspace, when a changeset moves or goes', () => {
    expect(isAffectedByChangesetMove(key('branchExplorer', {}))).toBe(true);
    expect(isAffectedByChangesetMove(key('branches', {}))).toBe(true);
    expect(isAffectedByChangesetMove(key('incoming', 'changes'))).toBe(true);
    expect(isAffectedByChangesetMove(key('pendingChanges'))).toBe(false);
    expect(isAffectedByChangesetMove(key('labels', {}))).toBe(false);
  });

  it('refreshes the branch lists and the Branch Explorer when a branch is created, deleted, hidden or described', () => {
    expect(isAffectedByBranchList(key('branches', {}))).toBe(true);
    // The palette's own copy of the hidden ones.
    expect(isAffectedByBranchList(key('branches', { onlyHidden: true }))).toBe(true);
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

  it('refreshes nothing in the workspace when permissions are saved, but the lists showing an owner that changed', () => {
    expect(isAffectedByPermissions('branch', false)(key('branches', 'all'))).toBe(false);
    expect(isAffectedByPermissions('branch', true)(key('branches', 'all'))).toBe(true);
    expect(isAffectedByPermissions('branch', true)(key('branchExplorer', {}))).toBe(true);
    expect(isAffectedByPermissions('branch', true)(key('labels'))).toBe(false);
    expect(isAffectedByPermissions('label', true)(key('labels'))).toBe(true);
    expect(isAffectedByPermissions('attribute', true)(key('attributeTypes'))).toBe(true);
    expect(isAffectedByPermissions('repository', true)(key('branches', 'all'))).toBe(false);
    expect(isAffectedByPermissions('path', true)(key('pendingChanges'))).toBe(false);
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

describe('incoming changeset pages', () => {
  const older = key('incoming', 'older', '/main', 1, 261);
  const newest = key('incoming', 'newest', '/main', 1, 261);

  it('are left alone by new changesets, check-ins, updates and switches: their key names the head they were read at', () => {
    for (const page of [older, newest]) {
      expect(isAffectedByNewChangesets(page)).toBe(false);
      expect(isAffectedByServerMerge(page)).toBe(false);
      expect(isAffectedByCheckinOrUpdate(page)).toBe(false);
      expect(isAffectedByLoadedChangeset(page)).toBe(false);
    }
  });

  it('are read again when a changeset is moved or deleted, which changes them under the same head', () => {
    expect(isAffectedByChangesetMove(older)).toBe(true);
    expect(isAffectedByChangesetMove(newest)).toBe(true);
  });

  it('leave the incoming changes themselves to the refreshes', () => {
    expect(isAffectedByNewChangesets(key('incoming', 'changes'))).toBe(true);
    expect(isAffectedByCheckinOrUpdate(key('incoming', 'changes'))).toBe(true);
  });
});

describe("a code review's page", () => {
  const branchReview = isShownByCodeReviewPage(7, { kind: 'branch', branch: '/main/task-12' });

  it('reads again the review, what was said on it and its reviewers, of that review only', () => {
    expect(branchReview(key('codeReviews', 'review', 7))).toBe(true);
    expect(branchReview(key('codeReviews', 'conversation', 7))).toBe(true);
    expect(branchReview(key('codeReviews', 'reviewers', 7))).toBe(true);
    expect(branchReview(key('codeReviews', 'conversation', 8))).toBe(false);
    expect(branchReview(key('codeReviews', 'review', 70))).toBe(false);
  });

  it('reads a repository explored without a workspace the same way', () => {
    const inRepository = (...parts: unknown[]) => ['repository', 'game@local', ...parts];
    expect(branchReview(inRepository('codeReviews', 'conversation', 7))).toBe(true);
    expect(branchReview(inRepository('diff', { kind: 'branch', branch: '/main/task-12' }))).toBe(true);
    expect(branchReview(inRepository('codeReviews', {}))).toBe(false);
  });

  it('leaves the lists of reviews, the branch chips and the rest of the window alone', () => {
    expect(branchReview(key('codeReviews', { onlyAssigned: true }))).toBe(false);
    expect(branchReview(key('codeReviews', 'summaries', { text: undefined }))).toBe(false);
    expect(branchReview(key('pendingChanges', 'all'))).toBe(false);
    expect(branchReview(key('info'))).toBe(false);
    expect(branchReview(key('branches', {}))).toBe(false);
    expect(branchReview(key('incoming', 'changes'))).toBe(false);
  });

  it("reads again a branch review's files and changesets, as a changeset checked in there changes them", () => {
    expect(branchReview(key('diff', { kind: 'branch', branch: '/main/task-12' }))).toBe(true);
    expect(branchReview(key('changesets', { branch: '/main/task-12' }))).toBe(true);
    expect(branchReview(key('diff', { kind: 'branch', branch: '/main/task-13' }))).toBe(false);
    expect(branchReview(key('changesets', { branch: '/main' }))).toBe(false);
    expect(branchReview(key('changesets', {}))).toBe(false);
  });

  it("leaves a changeset's or shelve's changes alone, and every diff while the review isn't read yet", () => {
    const changesetReview = isShownByCodeReviewPage(7, { kind: 'changeset', changesetId: 40 });
    const unread = isShownByCodeReviewPage(7, undefined);
    expect(changesetReview(key('codeReviews', 'conversation', 7))).toBe(true);
    expect(changesetReview(key('diff', { kind: 'changeset', changesetId: 40 }))).toBe(false);
    expect(isShownByCodeReviewPage(7, { kind: 'shelve', shelveId: 3 })(key('diff', { kind: 'shelve', shelveId: 3 }))).toBe(false);
    expect(unread(key('codeReviews', 'review', 7))).toBe(true);
    expect(unread(key('diff', { kind: 'branch', branch: '/main/task-12' }))).toBe(false);
  });
});
