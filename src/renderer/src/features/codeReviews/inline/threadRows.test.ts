import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import type { LineThread, PlacedThread, ThreadSide } from './fileThreads';
import { lineOfThread, lineThreadsOf, markerIsOpen, markerLabel, shownThreadRows } from './threadRows';

function thread(id: number, fields: Partial<ReviewComment> = {}, replies: ReviewComment[] = []): LineThread {
  const root: ReviewComment = {
    id,
    guid: `g${id}`,
    author: 'ana',
    date: `2026-11-06T10:${String(id).padStart(2, '0')}:00Z`,
    text: 'Text',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId: 30, itemId: 7, path: '/src/Player.cs', line: 1 },
    ...fields,
  };
  return threadsOf([root, ...replies])[0] as LineThread;
}

const at = (side: ThreadSide, line: number, entry: LineThread): PlacedThread => ({ thread: entry, side, line });

describe('lineThreadsOf', () => {
  it('gathers the threads of a line into one row, oldest first, the lines in the order the diff reads', () => {
    const lines = lineThreadsOf([at('additions', 9, thread(3)), at('additions', 2, thread(2)), at('additions', 9, thread(1)), at('deletions', 40, thread(4))]);
    expect(lines.map((line) => [line.key, line.threads.map((entry) => entry.thread.root.id)])).toEqual([
      ['deletions:40', [4]],
      ['additions:2', [2]],
      ['additions:9', [1, 3]],
    ]);
  });

  it('has no rows for a file without threads', () => {
    expect(lineThreadsOf([])).toEqual([]);
  });
});

describe('shownThreadRows', () => {
  const lines = lineThreadsOf([at('additions', 2, thread(1)), at('additions', 9, thread(2))]);

  it('shows every row with comments in the code, and no markers', () => {
    expect(shownThreadRows(lines, true, [])).toEqual({ rows: lines, markers: [] });
  });

  it('hidden, marks each line and shows only the rows opened', () => {
    const { rows, markers } = shownThreadRows(lines, false, ['additions:9']);
    expect(rows.map((line) => line.key)).toEqual(['additions:9']);
    expect(markers.map((line) => line.key)).toEqual(['additions:2']);
  });

  it('hidden, keeps the rows in the order their lines were opened', () => {
    expect(shownThreadRows(lines, false, ['additions:9', 'additions:2']).rows.map((line) => line.key)).toEqual(['additions:9', 'additions:2']);
  });
});

describe('lineOfThread', () => {
  it('finds the line holding a thread', () => {
    const lines = lineThreadsOf([at('additions', 2, thread(1)), at('additions', 9, thread(2))]);
    expect(lineOfThread(lines, 2)?.key).toBe('additions:9');
    expect(lineOfThread(lines, 5)).toBeUndefined();
  });
});

describe('markerLabel', () => {
  it("names one thread's kind, or how many there are", () => {
    expect(markerLabel({ line: 4, threads: [at('additions', 4, thread(1, { kind: 'question' }))] })).toBe('Question on line 4');
    expect(markerLabel({ line: 4, threads: [at('additions', 4, thread(1)), at('additions', 4, thread(2))] })).toBe('2 comments on line 4');
  });
});

describe('markerIsOpen', () => {
  it('stands out while a thread on the line is open', () => {
    const answered = thread(1, { kind: 'question' }, [{ ...thread(2).root, parentId: 1, kind: 'comment', anchor: { kind: 'review' } }]);
    expect(markerIsOpen({ threads: [at('additions', 1, answered)] })).toBe(false);
    expect(markerIsOpen({ threads: [at('additions', 1, answered), at('additions', 1, thread(3))] })).toBe(true);
  });
});
