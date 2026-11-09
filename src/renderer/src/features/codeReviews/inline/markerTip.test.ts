import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import type { LineThread, PlacedThread } from './fileThreads';
import { markerTip } from './markerTip';

const ON_LINE = { kind: 'line', revisionId: 30, itemId: 7, path: '/src/Retry.cs', line: 20 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'borja', date: `2026-11-06T10:${String(id).padStart(2, '0')}:00Z`, text: 'Text', kind: 'comment', anchor: ON_LINE, ...fields };
}

const reply = (id: number, parentId: number, fields: Partial<ReviewComment> = {}) => comment(id, { parentId, anchor: { kind: 'review' }, ...fields });

/** The thread a root and its replies make, at line 20. */
function placed(root: ReviewComment, ...replies: ReviewComment[]): PlacedThread {
  return { thread: threadsOf([root, ...replies])[0] as LineThread, side: 'additions', line: 20 };
}

const tipOf = (...threads: PlacedThread[]) => markerTip({ threads });

describe('markerTip', () => {
  it("previews a thread: its first words, then its kind, where it stands and who started it; never the line, which it's on", () => {
    expect(tipOf(placed(comment(1, { kind: 'question', text: 'Why not a while loop?' })))).toBe('Why not a while loop?\nQuestion · Open · Borja');
  });

  it('counts the replies, one in the singular', () => {
    const question = comment(1, { kind: 'question', text: 'Why not a while loop?' });
    expect(tipOf(placed(question, reply(2, 1)))).toBe('Why not a while loop?\nQuestion · Answered · Borja · 1 reply');
    expect(tipOf(placed(question, reply(2, 1), reply(3, 1), reply(4, 2)))).toBe('Why not a while loop?\nQuestion · Answered · Borja · 3 replies');
  });

  it('says a change request applied or discarded so, and a plain comment no state', () => {
    expect(tipOf(placed(comment(1, { kind: 'changeRequest', text: 'Shelve first.', appliedInChangeset: 4 })))).toBe('Shelve first.\nChange request · Applied · Borja');
    expect(tipOf(placed(comment(1, { kind: 'changeRequest', text: 'Rename it.' }), reply(2, 1, { kind: 'discard' })))).toBe('Rename it.\nChange request · Discarded · Borja · 1 reply');
    expect(tipOf(placed(comment(1, { text: 'Reads well.', author: 'ana.garcia' })))).toBe('Reads well.\nComment · Ana Garcia');
  });

  it('reads Markdown as plain text, its lines as one', () => {
    const text = '**Retry** with a `for` reads\n\n- backwards\n- [the docs](https://example.com)';
    expect(tipOf(placed(comment(1, { text }))).split('\n')[0]).toBe('Retry with a for reads • backwards • the docs');
  });

  it('cuts a long comment at a word, about 80 characters in, with an ellipsis', () => {
    const text = 'Why not a while loop? Retrying with a for reads backwards when the count is the thing that matters here.';
    const first = tipOf(placed(comment(1, { kind: 'question', text }))).split('\n')[0]!;
    expect(first).toBe('Why not a while loop? Retrying with a for reads backwards when the count is the…');
    expect([...first].length).toBeLessThanOrEqual(81);
  });

  it('never splits a character made of two code units', () => {
    const text = `${'a'.repeat(79)}😀😀 and more`;
    expect(tipOf(placed(comment(1, { text }))).split('\n')[0]).toBe(`${'a'.repeat(79)}😀…`);
  });

  it('previews each thread of a line, a blank line apart, three at most and how many more', () => {
    const threads = [1, 2, 3, 4, 5].map((id) => placed(comment(id * 10, { text: `Thread ${id}` })));
    expect(tipOf(...threads.slice(0, 2))).toBe('Thread 1\nComment · Borja\n\nThread 2\nComment · Borja');
    expect(tipOf(...threads)).toBe('Thread 1\nComment · Borja\n\nThread 2\nComment · Borja\n\nThread 3\nComment · Borja\n\n+2 more');
  });
});
