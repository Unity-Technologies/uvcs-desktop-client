import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { commentedComparison, contextDescription, contextViewLabels, sinceComparison, writtenDiffToRead, writtenEntryOf, type ShownEntry } from './commentContext';
import type { LineThread } from './fileThreads';

const BRANCH: CodeReviewTarget = { kind: 'branch', branch: '/main/task' };
const REPOSITORY = 'game@local';
// The whole branch's diff of the file: from the branch's base (10) to the newest (30).
const SHOWN: ShownEntry = { path: 'src/Player.cs', baseRevisionId: 10, revisionId: 30, repository: REPOSITORY };

function threadOn(revisionId: number, fields: Partial<ReviewComment> = {}, replies: Partial<ReviewComment>[] = []): LineThread {
  const root: ReviewComment = {
    id: 1,
    guid: 'g1',
    author: 'ana',
    date: '2026-11-06T10:00:00Z',
    text: 'Rename it',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId, itemId: 7, path: '/src/Player.cs', line: 12 },
    ...fields,
  };
  const answers = replies.map((reply, index): ReviewComment => ({ ...root, id: 2 + index, guid: `r${index}`, kind: 'comment', parentId: 1, ...reply }));
  return threadsOf([root, ...answers])[0] as LineThread;
}

const revision = (revisionId: number) => ({ kind: 'revision', revision: { revisionId, repository: REPOSITORY }, fileName: 'src/Player.cs' });

describe('writtenDiffToRead', () => {
  it("reads the diff of the changeset a thread was written in when another diff is on screen, none when it is that one's", () => {
    const inChangeset = threadOn(20, { changesetId: 8 });
    expect(writtenDiffToRead(BRANCH, inChangeset, { kind: 'whole' })).toBe(8);
    expect(writtenDiffToRead(BRANCH, inChangeset, { kind: 'changeset', changesetId: 8 })).toBeNull();
  });

  it("reads nothing for a thread written in the whole review's diff, nor on a review of anything but a branch", () => {
    expect(writtenDiffToRead(BRANCH, threadOn(20), { kind: 'whole' })).toBeNull();
    expect(writtenDiffToRead({ kind: 'shelve', shelveId: 3 }, threadOn(20, { changesetId: 8 }), { kind: 'whole' })).toBeNull();
  });
});

describe('writtenEntryOf', () => {
  it('finds the file by the path the thread names, or the one it moved from', () => {
    const moved: ShownEntry = { ...SHOWN, path: 'src/Hero.cs', oldPath: 'src/Player.cs' };
    expect(writtenEntryOf([{ ...SHOWN, path: 'src/Enemy.cs' }, moved], threadOn(20))).toBe(moved);
    expect(writtenEntryOf([{ ...SHOWN, path: 'src/Enemy.cs' }], threadOn(20))).toBeUndefined();
  });
});

describe('commentedComparison', () => {
  it('compares the older side of the diff it was written in with the version commented on, the thread on the newer side', () => {
    expect(commentedComparison(threadOn(20), SHOWN)).toEqual({ original: revision(10), modified: revision(20), side: 'additions', line: 12 });
  });

  it('starts from nothing for a file the diff added', () => {
    expect(commentedComparison(threadOn(20), { ...SHOWN, baseRevisionId: -1 }).original).toEqual({ kind: 'empty' });
  });

  it("keeps on the older side a comment on a file the diff deletes, which is on its last revision", () => {
    expect(commentedComparison(threadOn(25), { ...SHOWN, baseRevisionId: 25, revisionId: -1 })).toEqual({ original: revision(25), modified: { kind: 'empty' }, side: 'deletions', line: 12 });
  });
});

describe('sinceComparison', () => {
  it('compares the version commented on with the file as the changeset that applied it left it, the thread on the older side', () => {
    const applied = threadOn(20, { appliedInChangeset: 15 });
    expect(sinceComparison(applied, SHOWN)).toEqual({
      original: revision(20),
      modified: { kind: 'spec', spec: 'itemid:7#cs:15@game@local', fileName: 'src/Player.cs' },
      side: 'deletions',
      line: 12,
    });
  });

  it('compares a thread not applied with the newest version shown, or nothing when the diff deletes the file', () => {
    expect(sinceComparison(threadOn(20, { kind: 'question' }), SHOWN).modified).toEqual(revision(30));
    expect(sinceComparison(threadOn(20), { ...SHOWN, revisionId: -1 }).modified).toEqual({ kind: 'empty' });
  });
});

describe('contextViewLabels and contextDescription', () => {
  it('say how a change request was applied, and by which changeset', () => {
    const applied = threadOn(20, { appliedInChangeset: 15 });
    expect(contextViewLabels(applied)).toEqual({ commented: 'When commented', since: 'How it was applied' });
    expect(contextDescription(applied, 'since')).toBe('Line 12 as it was, against changeset 15, which applied it');
  });

  it('say what changed since for anything not applied', () => {
    const discarded = threadOn(20, {}, [{ kind: 'discard' }]);
    expect(contextViewLabels(discarded).since).toBe('Since then');
    expect(contextDescription(discarded, 'since')).toBe('Line 12 as it was, against the newest version');
    expect(contextDescription(discarded, 'commented')).toBe('Line 12 in the diff it was written on');
  });
});
