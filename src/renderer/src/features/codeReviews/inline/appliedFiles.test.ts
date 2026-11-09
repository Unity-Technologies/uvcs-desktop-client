import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { appliedFilesDescription, appliedFilesHeading, appliedFilesOf, contextBodyOf, commentedFileFlag, isCommentedEntry, listsAppliedFiles } from './appliedFiles';
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

describe('appliedFilesOf', () => {
  it("lists the files of a changeset that applied the request by changing its file and others, with the comment's", () => {
    expect(appliedFilesOf(APPLIED, [TESTS, COMMENTED])).toBe('withComment');
    expect(appliedFilesOf(APPLIED, [COMMENTED, entry('art/hero.png', { itemType: 'binaryFile' })])).toBe('withComment');
    expect(appliedFilesOf(APPLIED, [entry('src/game/Player.cs', { status: 'moved', oldPath: 'src/Player.cs' }), TESTS])).toBe('withComment');
  });

  it("lists the files of a changeset that applied the request in other files only, without the comment's", () => {
    expect(appliedFilesOf(APPLIED, [TESTS])).toBe('withoutComment');
    expect(appliedFilesOf(APPLIED, [entry('tests', { itemType: 'directory', status: 'added' }), entry('tests/PlayerTests.cs', { status: 'added', baseRevisionId: -1 })])).toBe('withoutComment');
  });

  it('lists none for a fix of that file alone, or of folders besides it: nothing more to see', () => {
    expect(appliedFilesOf(APPLIED, [COMMENTED])).toBe('none');
    expect(appliedFilesOf(APPLIED, [COMMENTED, entry('src', { itemType: 'directory' })])).toBe('none');
  });

  it('lists none for a changeset with no file to compare: the thread shows alone, and why', () => {
    expect(appliedFilesOf(APPLIED, [])).toBe('none');
    expect(appliedFilesOf(APPLIED, [entry('docs', { itemType: 'directory' })])).toBe('none');
  });

  it('lists none for a thread not applied, nor before the changeset is read', () => {
    expect(appliedFilesOf(threadOn(), [COMMENTED, TESTS])).toBe('none');
    expect(appliedFilesOf(APPLIED, undefined)).toBe('none');
  });
});

describe('listsAppliedFiles', () => {
  it("lists files with the comment's in both views", () => {
    expect(listsAppliedFiles('withComment', 'commented')).toBe(true);
    expect(listsAppliedFiles('withComment', 'since')).toBe(true);
  });

  it("lists files without the comment's in how it was applied alone: when commented is the comment's own diff", () => {
    expect(listsAppliedFiles('withoutComment', 'since')).toBe(true);
    expect(listsAppliedFiles('withoutComment', 'commented')).toBe(false);
  });

  it('lists nothing otherwise', () => {
    expect(listsAppliedFiles('none', 'since')).toBe(false);
    expect(listsAppliedFiles('none', 'commented')).toBe(false);
  });
});

describe('contextBodyOf', () => {
  it("lists the changeset's files under the thread when it applied it elsewhere, never the dead end that also is", () => {
    expect(contextBodyOf('withoutComment', 'since', 'notInChangeset')).toBe('threadAboveFiles');
  });

  it('shows the thread alone when the changeset has no file to compare', () => {
    expect(contextBodyOf('none', 'since', 'notInChangeset')).toBe('threadAlone');
  });

  it("lists the changeset's files in both views when it changed the commented file and others", () => {
    expect(contextBodyOf('withComment', 'since', 'comparison')).toBe('files');
    expect(contextBodyOf('withComment', 'commented', 'reading')).toBe('files');
  });

  it("shows the commented file's diff otherwise: when commented, or a fix of that file alone", () => {
    expect(contextBodyOf('withoutComment', 'commented', 'comparison')).toBe('diff');
    expect(contextBodyOf('none', 'since', 'comparison')).toBe('diff');
    expect(contextBodyOf('none', 'commented', 'missing')).toBe('diff');
  });
});

describe('appliedFilesHeading', () => {
  it("is the comment's while its diff shows alone", () => {
    expect(appliedFilesHeading('none', 'since', true)).toEqual({ describesComment: true, offersViews: true });
    expect(appliedFilesHeading('withoutComment', 'commented', true)).toEqual({ describesComment: true, offersViews: true });
  });

  it("is the comment's while its file is selected among the changeset's, the changeset's while another is", () => {
    expect(appliedFilesHeading('withComment', 'since', true)).toEqual({ describesComment: true, offersViews: true });
    expect(appliedFilesHeading('withComment', 'since', false)).toEqual({ describesComment: false, offersViews: false });
  });

  it('is the changeset\'s listing files without the comment, still offering the way back to when it was commented', () => {
    expect(appliedFilesHeading('withoutComment', 'since', true)).toEqual({ describesComment: false, offersViews: true });
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
    expect(appliedFilesDescription(APPLIED, 'withComment')).toBe('Changeset 15, which applied it');
  });

  it("says the changeset applied it in other files when it didn't change the commented one", () => {
    expect(appliedFilesDescription(APPLIED, 'withoutComment')).toBe('Changeset 15 applied it in other files');
  });
});

describe('commentedFileFlag', () => {
  it('marks the commented file alone, and offers no chip', () => {
    const flag = commentedFileFlag(APPLIED);
    const markOf = flag.markOf({ kind: 'changeset', changesetId: 15 });
    expect(markOf(COMMENTED)).toBe('The comment is on this file');
    expect(markOf(TESTS)).toBeNull();
    expect(flag.filterLabel).toBeUndefined();
  });
});
