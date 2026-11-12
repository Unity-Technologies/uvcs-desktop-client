import { describe, expect, it } from 'vitest';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { earlierRevisions, placeEarlier, reviewDiffViewOf, threadsOfFile, writtenIn, type LineThread, type ShownFile } from './fileThreads';

const BRANCH: CodeReviewTarget = { kind: 'branch', branch: '/main/task' };
const CHANGESET_REVIEW: CodeReviewTarget = { kind: 'changeset', changesetId: 8 };
const WHOLE = { kind: 'whole' } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: `2026-11-06T10:${String(id).padStart(2, '0')}:00Z`, text: `Comment ${id}`, kind: 'changeRequest', anchor: { kind: 'review' }, ...fields };
}

const onLine = (id: number, revisionId: number, line: number, fields: Partial<ReviewComment> = {}): ReviewComment =>
  comment(id, { anchor: { kind: 'line', revisionId, itemId: 7, path: '/src/Player.cs', line }, ...fields });

const PLAYER: ShownFile = { path: 'src/Player.cs', originalRevision: 10, modifiedRevision: 30 };

const ids = (entries: readonly { thread: LineThread }[]): number[] => entries.map((entry) => entry.thread.root.id);

describe('reviewDiffViewOf', () => {
  it('is a changeset of a branch review stepped to, else the whole review', () => {
    expect(reviewDiffViewOf(BRANCH, { kind: 'branch', branch: '/main/task' })).toEqual(WHOLE);
    expect(reviewDiffViewOf(BRANCH, { kind: 'changeset', changesetId: 5 })).toEqual({ kind: 'changeset', changesetId: 5 });
    expect(reviewDiffViewOf(CHANGESET_REVIEW, { kind: 'changeset', changesetId: 8 })).toEqual(WHOLE);
    expect(reviewDiffViewOf({ kind: 'shelve', shelveId: 3 }, { kind: 'shelve', shelveId: 3 })).toEqual(WHOLE);
  });

  // Several changesets selected in a branch diff's list diff as a range: its threads are placed by revision, as
  // the whole branch's are, those on its older revision on the left at their line.
  it("is the whole review for a span of a branch review's changesets", () => {
    expect(reviewDiffViewOf(BRANCH, { kind: 'range', fromSpec: 'cs:14', toSpec: 'cs:17' })).toEqual(WHOLE);
  });

  it('places the threads a span shows by revision, written in any of its modes', () => {
    const span = reviewDiffViewOf(BRANCH, { kind: 'range', fromSpec: 'cs:14', toSpec: 'cs:17' });
    const threads = threadsOf([onLine(1, 10, 3, { changesetId: 12 }), onLine(2, 30, 8)]);
    const { placed } = threadsOfFile(threads, BRANCH, span, PLAYER);
    expect(placed.map(({ thread, side, line }) => [thread.root.id, side, line])).toEqual([
      [1, 'deletions', 3],
      [2, 'additions', 8],
    ]);
  });
});

describe('writtenIn', () => {
  it('is the changeset a branch review comment was written in, or the whole review', () => {
    const [byChangeset, whole] = threadsOf([onLine(1, 30, 4, { changesetId: 5 }), onLine(2, 30, 4)]);
    expect(writtenIn(BRANCH, byChangeset!)).toEqual({ kind: 'changeset', changesetId: 5 });
    expect(writtenIn(BRANCH, whole!)).toEqual(WHOLE);
  });

  it('is the whole review on a review of a changeset, whatever changeset is stored', () => {
    const [thread] = threadsOf([onLine(1, 30, 4, { changesetId: 8 })]);
    expect(writtenIn(CHANGESET_REVIEW, thread!)).toEqual(WHOLE);
  });
});

describe('threadsOfFile', () => {
  it('places a thread on the newer revision on the newer side, at its line', () => {
    const { placed, earlier } = threadsOfFile(threadsOf([onLine(1, 30, 12)]), BRANCH, WHOLE, PLAYER);
    expect(placed.map(({ side, line }) => [side, line])).toEqual([['additions', 12]]);
    expect(earlier).toEqual([]);
  });

  it('shows in a changeset\'s diff the change requests it applied, on the version they were written on', () => {
    // Written on the whole branch at revision 10, applied by changeset 12, whose diff shows 10 on its older side.
    const threads = threadsOf([onLine(1, 10, 3, { kind: 'changeRequest', appliedInChangeset: 12 }), onLine(2, 10, 4, { kind: 'changeRequest', appliedInChangeset: 13 })]);
    const { placed } = threadsOfFile(threads, BRANCH, { kind: 'changeset', changesetId: 12 }, PLAYER);
    expect(placed.map(({ thread, side, line }) => [thread.root.id, side, line])).toEqual([[1, 'deletions', 3]]);
  });

  it('places a thread on the older revision on the older side: a deleted file, or the revision commented on', () => {
    const deleted: ShownFile = { path: 'src/Player.cs', originalRevision: 10, modifiedRevision: -1 };
    const { placed } = threadsOfFile(threadsOf([onLine(1, 10, 3)]), BRANCH, WHOLE, deleted);
    expect(placed.map(({ side, line }) => [side, line])).toEqual([['deletions', 3]]);
  });

  it('keeps a thread on another revision of the file to place by where its line went', () => {
    const { placed, earlier } = threadsOfFile(threadsOf([onLine(1, 20, 5)]), BRANCH, WHOLE, PLAYER);
    expect(placed).toEqual([]);
    expect(earlier.map((entry) => entry.revisionId)).toEqual([20]);
  });

  it("leaves out other files' threads, the review's own comments and replies", () => {
    const threads = threadsOf([
      comment(1, { kind: 'general' }),
      comment(2, { anchor: { kind: 'line', revisionId: 30, itemId: 9, path: '/src/Enemy.cs', line: 1 } }),
      onLine(3, 30, 8),
      comment(4, { parentId: 3, kind: 'comment', anchor: { kind: 'review' } }),
    ]);
    const { placed } = threadsOfFile(threads, BRANCH, WHOLE, PLAYER);
    expect(ids(placed)).toEqual([3]);
    expect(placed[0]!.thread.replies.map((reply) => reply.id)).toEqual([4]);
  });

  it('finds a moved file by the path it had when commented', () => {
    const moved: ShownFile = { path: 'src/Hero.cs', oldPath: 'src/Player.cs', originalRevision: 10, modifiedRevision: 30 };
    expect(ids(threadsOfFile(threadsOf([onLine(1, 30, 2)]), BRANCH, WHOLE, moved).placed)).toEqual([1]);
  });

  it("shows in a changeset's diff only the threads written in it", () => {
    const threads = threadsOf([onLine(1, 30, 1), onLine(2, 30, 2, { changesetId: 5 }), onLine(3, 30, 3, { changesetId: 6 })]);
    expect(ids(threadsOfFile(threads, BRANCH, { kind: 'changeset', changesetId: 5 }, PLAYER).placed)).toEqual([2]);
  });

  it("shows in the whole review's diff the threads written in one changeset's diff too", () => {
    const threads = threadsOf([onLine(1, 30, 1), onLine(2, 30, 2, { changesetId: 5 })]);
    expect(ids(threadsOfFile(threads, BRANCH, WHOLE, PLAYER).placed)).toEqual([1, 2]);
  });
});

describe('placeEarlier', () => {
  const OLD_TEXT = 'old text';
  const threads = threadsOf([onLine(1, 20, 5), onLine(2, 20, 9), onLine(3, 25, 1), onLine(4, 20, 9, { changesetId: 5 })]);
  const { earlier } = threadsOfFile(threads, BRANCH, WHOLE, PLAYER);
  // Line 5 of revision 20 is line 7 now; line 9 changed since.
  const lineOf = (_text: string, line: number): number | null => (line === 5 ? 7 : null);
  const writtenWhole = (thread: LineThread): boolean => thread.root.changesetId === undefined;

  it('places a thread whose line is unchanged since at its line now, saying where it was written', () => {
    const { placed } = placeEarlier(earlier, (revision) => (revision === 20 ? OLD_TEXT : null), lineOf, writtenWhole);
    expect(placed.map(({ thread, side, line, earlier: from }) => [thread.root.id, side, line, from?.revisionId])).toEqual([[1, 'additions', 7, 20]]);
  });

  it('keeps apart, as outdated, a thread whose line changed', () => {
    const { outdated } = placeEarlier(earlier, () => OLD_TEXT, lineOf, writtenWhole);
    expect(ids(outdated)).toEqual([2, 3]);
  });

  it("leaves a changeset's outdated thread to its changeset's diff", () => {
    const { placed, outdated } = placeEarlier(earlier, () => OLD_TEXT, lineOf, writtenWhole);
    expect(ids([...placed, ...outdated])).not.toContain(4);
  });

  it('holds every earlier thread while any version is still read, so none moves once placed', () => {
    const { placed, outdated, reading } = placeEarlier(earlier, (revision) => (revision === 25 ? OLD_TEXT : undefined), lineOf, writtenWhole);
    expect([ids(placed), ids(outdated)]).toEqual([[], []]);
    expect(ids(reading).sort()).toEqual([1, 2, 3, 4]);
  });

  it("places the others' threads when a version's read fails, showing that one's among the outdated: its line is known", () => {
    const { placed, outdated, reading } = placeEarlier(earlier, (revision) => (revision === 20 ? OLD_TEXT : null), lineOf, writtenWhole);
    expect([ids(placed), ids(outdated), ids(reading)]).toEqual([[1], [2, 3], []]);
  });
});

describe('earlierRevisions', () => {
  it('names each earlier version once', () => {
    const { earlier } = threadsOfFile(threadsOf([onLine(1, 20, 5), onLine(2, 20, 9), onLine(3, 25, 1)]), BRANCH, WHOLE, PLAYER);
    expect(earlierRevisions(earlier)).toEqual([20, 25]);
  });
});
