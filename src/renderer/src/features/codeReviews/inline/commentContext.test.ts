import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { appliedComparison, commentedComparison, comparisonOf, contextMissingText, contextDescription, contextEntryOf, contextTitle, contextViewLabels, entryOfThread, liveThreadOf, sinceComparison, type ShownEntry } from './commentContext';
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

describe('contextEntryOf', () => {
  const inChangeset = threadOn(20, { changesetId: 8 });
  const whole = { view: { kind: 'whole' } } as const;

  it("shows a thread as written from the diff on screen when it's the one it was written in", () => {
    expect(contextEntryOf(BRANCH, threadOn(20), 'commented', whole)).toEqual({ kind: 'onScreen' });
    expect(contextEntryOf(BRANCH, inChangeset, 'commented', { view: { kind: 'changeset', changesetId: 8 } })).toEqual({ kind: 'onScreen' });
  });

  it('reads the diff it was written in otherwise: its changeset, or the whole review, as the Changes tab reads it', () => {
    expect(contextEntryOf(BRANCH, inChangeset, 'commented', whole)).toEqual({ kind: 'read', target: { kind: 'changeset', changesetId: 8 } });
    expect(contextEntryOf(BRANCH, threadOn(20), 'commented', null)).toEqual({ kind: 'read', target: { kind: 'branch', branch: '/main/task' } });
    expect(contextEntryOf({ kind: 'shelve', shelveId: 3 }, inChangeset, 'commented', null)).toEqual({ kind: 'read', target: { kind: 'shelve', shelveId: 3 } });
  });

  it("reads the diff of the changeset that applied a change request, and the review's newest version for anything else, never a changeset's", () => {
    expect(contextEntryOf(BRANCH, threadOn(20, { appliedInChangeset: 15 }), 'since', null)).toEqual({ kind: 'read', target: { kind: 'changeset', changesetId: 15 } });
    expect(contextEntryOf(BRANCH, threadOn(20), 'since', whole)).toEqual({ kind: 'onScreen' });
    expect(contextEntryOf(BRANCH, threadOn(20, { changesetId: 8 }), 'since', { view: { kind: 'changeset', changesetId: 8 } })).toEqual({ kind: 'read', target: { kind: 'branch', branch: '/main/task' } });
    expect(contextEntryOf(BRANCH, threadOn(20), 'since', null)).toEqual({ kind: 'read', target: { kind: 'branch', branch: '/main/task' } });
  });

  it('has nothing to read on a review whose target is unknown', () => {
    expect(contextEntryOf({ kind: 'unknown', description: '?' }, threadOn(20), 'commented', null)).toEqual({ kind: 'none' });
  });
});

describe('entryOfThread', () => {
  it('finds the file by the path the thread names, or the one it moved from', () => {
    const moved: ShownEntry = { ...SHOWN, path: 'src/Hero.cs', oldPath: 'src/Player.cs' };
    expect(entryOfThread([{ ...SHOWN, path: 'src/Enemy.cs' }, moved], threadOn(20))).toBe(moved);
    expect(entryOfThread([{ ...SHOWN, path: 'src/Enemy.cs' }], threadOn(20))).toBeUndefined();
  });
});

describe('commentedComparison', () => {
  it('compares the older side of the diff it was written in with the version commented on, the thread on the newer side', () => {
    expect(commentedComparison(threadOn(20), SHOWN)).toEqual({ original: revision(10), modified: revision(20), side: 'additions', line: 12, fileName: 'src/Player.cs' });
  });

  it('starts from nothing for a file the diff added', () => {
    expect(commentedComparison(threadOn(20), { ...SHOWN, baseRevisionId: -1 }).original).toEqual({ kind: 'empty' });
  });

  it('keeps a comment on a removed line on the older side, against the newer side of the diff it was written in', () => {
    expect(commentedComparison(threadOn(10), { ...SHOWN, baseRevisionId: 10, revisionId: 20 })).toEqual({ original: revision(10), modified: revision(20), side: 'deletions', line: 12, fileName: 'src/Player.cs' });
  });

  it('names each side as the diff names it, the older one by the path the file moved from', () => {
    const moved: ShownEntry = { ...SHOWN, path: 'src/Hero.cs', oldPath: 'src/Player.cs' };
    expect(commentedComparison(threadOn(20), moved)).toMatchObject({ original: { fileName: 'src/Player.cs' }, modified: { fileName: 'src/Hero.cs' } });
  });

  it("keeps on the older side a comment on a file the diff deletes, which is on its last revision", () => {
    expect(commentedComparison(threadOn(25), { ...SHOWN, baseRevisionId: 25, revisionId: -1 })).toEqual({ original: revision(25), modified: { kind: 'empty' }, side: 'deletions', line: 12, fileName: 'src/Player.cs' });
  });
});

describe('appliedComparison', () => {
  const applied = threadOn(20, { appliedInChangeset: 15 });

  it('compares the version commented on with what the changeset that applied it left, the thread on the older side', () => {
    expect(appliedComparison(applied, { ...SHOWN, baseRevisionId: 22, revisionId: 25 })).toEqual({ original: revision(20), modified: revision(25), side: 'deletions', line: 12, fileName: 'src/Player.cs' });
  });

  it("shows that changeset's own diff when the comment is on the version it made, the thread on the newer side", () => {
    expect(appliedComparison(applied, { ...SHOWN, baseRevisionId: 18, revisionId: 20 })).toEqual({ original: revision(18), modified: revision(20), side: 'additions', line: 12, fileName: 'src/Player.cs' });
  });

  it("has nothing to compare when that changeset didn't change the file (marked applied by hand)", () => {
    expect(appliedComparison(applied, null)).toBeNull();
    expect(contextMissingText(applied, 'since')).toBe("Changeset 15 didn't change this file");
    expect(contextMissingText(applied, 'commented')).toBe("Couldn't find the diff it was written on");
  });
});

describe('sinceComparison', () => {
  it('compares a thread not applied with the newest version shown, or nothing when the diff deletes the file', () => {
    expect(sinceComparison(threadOn(20, { kind: 'question' }), REPOSITORY, SHOWN).modified).toEqual(revision(30));
    expect(sinceComparison(threadOn(20), REPOSITORY, { ...SHOWN, revisionId: -1 }).modified).toEqual({ kind: 'empty' });
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

describe('contextTitle', () => {
  it("names the file and the line, the folder left out", () => {
    expect(contextTitle(threadOn(20))).toBe('Player.cs, line 12');
    expect(contextTitle(threadOn(20, { anchor: { kind: 'line', revisionId: 20, itemId: 7, path: '/README.md', line: 3 } }))).toBe('README.md, line 3');
  });
});

describe('liveThreadOf', () => {
  it('is the thread as the conversation has it now, gone once deleted, and waits while it is read', () => {
    const threads = threadsOf([threadOn(20).root, { ...threadOn(20).root, id: 2, guid: 'r', parentId: 1, kind: 'comment' }]);
    expect(liveThreadOf(threads, 1)).toEqual({ kind: 'thread', thread: threads[0] });
    expect(liveThreadOf(threads, 9)).toEqual({ kind: 'gone' });
    expect(liveThreadOf(undefined, 1)).toEqual({ kind: 'reading' });
  });
});

describe('comparisonOf', () => {
  it('shows what was done since without an entry, but a thread as written, or as applied, only with the diff it needs', () => {
    const applied = threadOn(20, { appliedInChangeset: 15 });
    expect(comparisonOf(threadOn(20), 'since', REPOSITORY, null)?.side).toBe('deletions');
    expect(comparisonOf(applied, 'since', REPOSITORY, { ...SHOWN, baseRevisionId: 22, revisionId: 25 })?.side).toBe('deletions');
    expect(comparisonOf(applied, 'commented', REPOSITORY, null)).toBeNull();
    expect(comparisonOf(applied, 'commented', REPOSITORY, SHOWN)?.side).toBe('additions');
  });
});
