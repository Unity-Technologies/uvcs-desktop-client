import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { fileMenuTargets, hasRevisionsToShow, itemViews } from './fileMenuTargets';
import { PendingChangesIndex } from './itemStatus';

const item = (path: string, overrides: Partial<TreeItem> = {}): TreeItem => ({
  path,
  name: path.slice(path.lastIndexOf('/') + 1),
  itemType: 'file',
  size: 1,
  date: '',
  isPrivate: false,
  isCheckedOut: false,
  changeset: 1,
  branch: '/main',
  owner: 'jane',
  revisionId: 2,
  parentRevisionId: -1,
  repository: 'game@local',
  itemId: 3,
  ...overrides,
});

const change = (path: string, kind: ChangeKind): PendingChange => ({ path, kinds: [kind], itemType: 'file', size: 1, lastModified: '' });

describe('fileMenuTargets', () => {
  it('offers no undo for private items, which the pending changes list too', () => {
    const index = new PendingChangesIndex([change('notes.txt', 'private'), change('app.ts', 'changed')]);
    const targets = fileMenuTargets([item('notes.txt', { isPrivate: true }), item('app.ts')], index);
    expect(targets.undoable.map((undoable) => undoable.path)).toEqual(['app.ts']);
    expect(targets.privateItems.map((privateItem) => privateItem.path)).toEqual(['notes.txt']);
  });

  it('checks out only controlled items with nothing pending', () => {
    const index = new PendingChangesIndex([change('app.ts', 'changed')]);
    const targets = fileMenuTargets([item('app.ts'), item('lib.ts'), item('co.ts', { isCheckedOut: true }), item('new.txt', { isPrivate: true })], index);
    expect(targets.checkoutCandidates.map((candidate) => candidate.path)).toEqual(['lib.ts']);
  });

  it('changes the revision type of files only, never through a link', () => {
    const targets = fileMenuTargets([item('a.txt'), item('link', { itemType: 'symlink' }), item('src', { itemType: 'directory' })], new PendingChangesIndex([]));
    expect(targets.typedFiles.map((file) => file.path)).toEqual(['a.txt']);
  });
});

describe('hasRevisionsToShow', () => {
  it('holds for controlled items, not for private or just added ones', () => {
    const index = new PendingChangesIndex([change('new.ts', 'added'), change('app.ts', 'changed')]);
    expect(hasRevisionsToShow(item('app.ts'), index)).toBe(true);
    expect(hasRevisionsToShow(item('lib.ts'), index)).toBe(true);
    expect(hasRevisionsToShow(item('new.ts', { revisionId: -1 }), index)).toBe(false);
    expect(hasRevisionsToShow(item('notes.txt', { isPrivate: true }), index)).toBe(false);
  });
});

describe('itemViews', () => {
  const none = new PendingChangesIndex([]);

  it("leads a controlled file to its history, its annotations and its diff", () => {
    expect(itemViews(item('app.ts'), none)).toEqual({ history: true, annotate: true, changes: true });
  });

  it('leads a folder to its history only, and the workspace root nowhere: its history is the whole repository', () => {
    expect(itemViews(item('src', { itemType: 'directory' }), none)).toEqual({ history: true, annotate: false, changes: false });
    expect(itemViews(item('', { itemType: 'directory' }), none)).toEqual({ history: false, annotate: false, changes: false });
  });

  it('has no history or annotations for a file without revisions yet', () => {
    const added = new PendingChangesIndex([change('new.ts', 'added')]);
    expect(itemViews(item('new.ts'), added)).toEqual({ history: false, annotate: false, changes: true });
    expect(itemViews(item('notes.txt', { isPrivate: true }), none)).toEqual({ history: false, annotate: false, changes: false });
  });
});
