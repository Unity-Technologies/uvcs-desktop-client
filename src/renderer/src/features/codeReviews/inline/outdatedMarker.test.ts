import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { outdatedKey } from './fileComments';
import type { EarlierThread, LineThread } from './fileThreads';
import { outdatedMarkerOf } from './outdatedMarker';

const ON_LINE = { kind: 'line', revisionId: 30, itemId: 7, path: '/src/Retry.cs', line: 20 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'borja', date: `2026-11-06T10:${String(id).padStart(2, '0')}:00Z`, text: `Thread ${id}`, kind: 'comment', anchor: ON_LINE, ...fields };
}

const reply = (id: number, parentId: number, fields: Partial<ReviewComment> = {}) => comment(id, { parentId, anchor: { kind: 'review' }, ...fields });

/** An outdated thread a root and its replies make, written on revision 30. */
function outdated(root: ReviewComment, ...replies: ReviewComment[]): EarlierThread {
  return { thread: threadsOf([root, ...replies])[0] as LineThread, revisionId: 30 };
}

const NONE_OPENED: string[] = [];

describe('outdatedMarkerOf', () => {
  it('marks a file with outdated comments while they are hidden, as a line with comments is', () => {
    const threads = [outdated(comment(1)), outdated(comment(2, { author: 'ana.garcia' }), reply(3, 2))];
    const marker = outdatedMarkerOf(threads, NONE_OPENED);
    expect(marker?.threads.map((entry) => entry.thread.root.id)).toEqual([1, 2]);
    expect(marker?.label).toBe('2 outdated comments, by Borja and Ana Garcia');
  });

  it('counts the outdated threads, as the strip above the code does, not their replies', () => {
    const marker = outdatedMarkerOf([outdated(comment(1), reply(2, 1), reply(3, 1))], NONE_OPENED);
    expect(marker?.count).toBe(1);
    expect(marker?.label).toBe('1 outdated comment, by Borja');
  });

  it('says on hover what outdated means, then previews each thread', () => {
    const marker = outdatedMarkerOf([outdated(comment(1, { kind: 'question', text: 'Why not a while loop?' }))], NONE_OPENED);
    expect(marker?.tip).toBe('1 outdated comment, on lines changed since\n\nWhy not a while loop?\nQuestion · Open · Borja');
  });

  it('stands out while one of them is still open, as a line marker does', () => {
    expect(outdatedMarkerOf([outdated(comment(1, { kind: 'question' }))], NONE_OPENED)?.emphasized).toBe(true);
    expect(outdatedMarkerOf([outdated(comment(1))], NONE_OPENED)?.emphasized).toBe(false);
  });

  it('opens every outdated thread it marks, after what was already opened', () => {
    const marker = outdatedMarkerOf([outdated(comment(1)), outdated(comment(2))], ['additions:12']);
    expect(marker?.opens).toEqual(['additions:12', outdatedKey(1), outdatedKey(2)]);
  });

  it('marks only the ones still folded away: one gone to shows already', () => {
    const opened = [outdatedKey(1)];
    const marker = outdatedMarkerOf([outdated(comment(1)), outdated(comment(2))], opened);
    expect(marker?.threads.map((entry) => entry.thread.root.id)).toEqual([2]);
    expect(marker?.opens).toEqual([outdatedKey(1), outdatedKey(2)]);
  });

  it('marks nothing when the file has none, or every one shows', () => {
    expect(outdatedMarkerOf([], NONE_OPENED)).toBeNull();
    expect(outdatedMarkerOf([outdated(comment(1))], [outdatedKey(1)])).toBeNull();
  });
});
