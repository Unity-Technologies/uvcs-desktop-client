import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { appliedFilesDescription, isCommentedEntry, listsAppliedFiles } from './appliedFiles';
import type { LineThread } from './fileThreads';

function threadOn(fields: Partial<ReviewComment> = {}): LineThread {
  const root: ReviewComment = {
    id: 1,
    guid: 'g1',
    author: 'ana',
    date: '2026-11-06T10:00:00Z',
    text: 'Rename it',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId: 20, itemId: 7, path: '/src/Player.cs', line: 12 },
    ...fields,
  };
  return threadsOf([root])[0] as LineThread;
}

function entry(path: string, fields: Partial<DiffEntry> = {}): DiffEntry {
  return { status: 'changed', path, itemType: 'file', baseRevisionId: 20, revisionId: 25, repository: 'game@local', ...fields };
}

const APPLIED = threadOn({ appliedInChangeset: 15 });
const COMMENTED = entry('src/Player.cs');
const TESTS = entry('tests/PlayerTests.cs');

describe('listsAppliedFiles', () => {
  it('lists the files of a changeset that applied the request by changing its file and others', () => {
    expect(listsAppliedFiles(APPLIED, [TESTS, COMMENTED])).toBe(true);
    expect(listsAppliedFiles(APPLIED, [COMMENTED, entry('art/hero.png', { itemType: 'binaryFile' })])).toBe(true);
    expect(listsAppliedFiles(APPLIED, [entry('src/game/Player.cs', { status: 'moved', oldPath: 'src/Player.cs' }), TESTS])).toBe(true);
  });

  it('lists none for a fix of that file alone, or of folders besides it: nothing more to see', () => {
    expect(listsAppliedFiles(APPLIED, [COMMENTED])).toBe(false);
    expect(listsAppliedFiles(APPLIED, [COMMENTED, entry('src', { itemType: 'directory' })])).toBe(false);
  });

  it("lists none for a request marked applied in a changeset that didn't change its file", () => {
    expect(listsAppliedFiles(APPLIED, [TESTS])).toBe(false);
  });

  it('lists none for a thread not applied, nor before the changeset is read', () => {
    expect(listsAppliedFiles(threadOn(), [COMMENTED, TESTS])).toBe(false);
    expect(listsAppliedFiles(APPLIED, undefined)).toBe(false);
  });
});

describe('isCommentedEntry', () => {
  it('knows the commented file by its path, or the one it moved from', () => {
    expect(isCommentedEntry(COMMENTED, APPLIED)).toBe(true);
    expect(isCommentedEntry(entry('src/game/Player.cs', { status: 'moved', oldPath: 'src/Player.cs' }), APPLIED)).toBe(true);
    expect(isCommentedEntry(TESTS, APPLIED)).toBe(false);
  });
});

describe('appliedFilesDescription', () => {
  it('names the changeset whose files are listed', () => {
    expect(appliedFilesDescription(APPLIED)).toBe('Changeset 15, which applied it');
  });
});
