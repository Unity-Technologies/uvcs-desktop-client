import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { commentMapTicks, commentMapTip } from './commentMapTicks';
import { OUTDATED_ROW, type FileComments } from './fileComments';
import type { EarlierThread, LineThread, ThreadSide } from './fileThreads';
import { lineThreadsOf, shownThreadRows } from './threadRows';

const ON_LINE = { kind: 'line', revisionId: 30, itemId: 7, path: '/src/Retry.cs', line: 20 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'borja', date: `2026-11-06T10:${String(id).padStart(2, '0')}:00Z`, text: `Thread ${id}`, kind: 'comment', anchor: ON_LINE, ...fields };
}

const reply = (id: number, parentId: number, fields: Partial<ReviewComment> = {}) => comment(id, { parentId, anchor: { kind: 'review' }, ...fields });

const threadOf = (root: ReviewComment, ...replies: ReviewComment[]): LineThread => threadsOf([root, ...replies])[0] as LineThread;

/** A file's comments: threads at lines (side, line, thread), and outdated ones. */
function fileComments(placed: [ThreadSide, number, LineThread][], outdated: LineThread[] = []): Pick<FileComments, 'lines' | 'outdated'> {
  return {
    lines: lineThreadsOf(placed.map(([side, line, thread]) => ({ side, line, thread }))),
    outdated: outdated.map((thread): EarlierThread => ({ thread, revisionId: 12 })),
  };
}

const question = (id: number, text = `Thread ${id}`) => comment(id, { kind: 'question', text });

describe('commentMapTicks', () => {
  it('ticks each line with threads, on its side, whether its comments show in the code or are folded into a marker', () => {
    const comments = fileComments([
      ['additions', 12, threadOf(comment(1))],
      ['deletions', 40, threadOf(comment(2))],
    ]);
    const ticks = commentMapTicks(comments, 'additions');
    expect(ticks.map(({ side, lineNumber }) => ({ side, lineNumber }))).toEqual([
      { side: 'deletions', lineNumber: 40 },
      { side: 'additions', lineNumber: 12 },
    ]);
    // Hidden in the code, each of these lines is a marker instead of a row: the ticks are the same lines.
    expect(shownThreadRows(comments.lines, false, []).markers.map((line) => line.key)).toEqual(ticks.map((tick) => tick.key));
  });

  it('ticks one line once, however many threads it holds', () => {
    expect(commentMapTicks(fileComments([['additions', 12, threadOf(comment(1))], ['additions', 12, threadOf(comment(2))]]), 'additions')).toHaveLength(1);
  });

  it('ticks the outdated comments above the code, at the top, on the side the file has', () => {
    const outdated = [threadOf(comment(1)), threadOf(comment(2))];
    expect(commentMapTicks(fileComments([], outdated), 'deletions')).toEqual([{ key: OUTDATED_ROW, side: 'deletions', lineNumber: 0, emphasized: false }]);
  });

  it('stands out while anything there is open, as its line marker does, and is quiet once all of it is settled', () => {
    const open = fileComments([['additions', 12, threadOf(comment(1))], ['additions', 12, threadOf(question(2))]], [threadOf(question(3))]);
    expect(commentMapTicks(open, 'additions').map((tick) => tick.emphasized)).toEqual([true, true]);
    const settled = fileComments([['additions', 12, threadOf(question(1), reply(2, 1))]], [threadOf(comment(3))]);
    expect(commentMapTicks(settled, 'additions').map((tick) => tick.emphasized)).toEqual([false, false]);
  });

  it('ticks nothing for a file with no comments placed', () => {
    expect(commentMapTicks(fileComments([]), 'additions')).toEqual([]);
  });
});

describe('commentMapTip', () => {
  const comments = fileComments(
    [
      ['additions', 12, threadOf(question(1, 'Why not a while loop?'), reply(2, 1))],
      ['additions', 14, threadOf(comment(3, { text: 'Reads well.', author: 'ana.garcia' }))],
      ['additions', 16, threadOf(question(4, 'And here?'))],
      ['additions', 18, threadOf(question(5, 'Why twice?'))],
    ],
    [threadOf(question(6, 'Still needed?'))],
  );

  it("previews a line's threads as its marker does", () => {
    expect(commentMapTip(comments, ['additions:12'])).toBe('Why not a while loop?\nQuestion · Answered · Borja · 1 reply');
  });

  it('says what outdated means before the outdated ones, as their marker does', () => {
    expect(commentMapTip(comments, [OUTDATED_ROW])).toBe('Outdated: on lines changed since\n\nStill needed?\nQuestion · Open · Borja');
  });

  it("previews the threads of spots fused into one tick together, in the tick's order, three at most and then how many more", () => {
    expect(commentMapTip(comments, ['additions:12', 'additions:14'])).toBe('Why not a while loop?\nQuestion · Answered · Borja · 1 reply\n\nReads well.\nComment · Ana Garcia');
    expect(commentMapTip(comments, [OUTDATED_ROW, 'additions:12', 'additions:14', 'additions:16', 'additions:18'])).toBe(
      'Still needed?\nQuestion · Open · Borja\n\nWhy not a while loop?\nQuestion · Answered · Borja · 1 reply\n\nReads well.\nComment · Ana Garcia\n\n+2 more',
    );
  });
});
