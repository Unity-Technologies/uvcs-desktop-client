import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { imagePinNumbers } from './imagePins';

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: '', text: '', kind: 'comment', anchor: { kind: 'review' }, ...fields };
}

const onImage = (id: number, path: string, revisionId = 5): ReviewComment => comment(id, { anchor: { kind: 'image', revisionId, itemId: 1, path, spot: { x: id, y: id } } });

describe('imagePinNumbers', () => {
  it('numbers each image\'s threads from 1, in the order they were started', () => {
    const threads = threadsOf([onImage(9, '/Art/Hero.png'), onImage(4, '/Art/Hero.png'), onImage(6, '/Art/Sky.png'), onImage(12, '/Art/Hero.png', 8)]);
    expect([...imagePinNumbers(threads)].sort((a, b) => a[0] - b[0])).toEqual([
      [4, 1],
      [6, 1],
      [9, 2],
      [12, 3],
    ]);
  });

  it('numbers no reply, and no thread on lines or on the review', () => {
    const threads = threadsOf([
      onImage(1, '/Art/Hero.png'),
      comment(2, { parentId: 1 }),
      comment(3, { anchor: { kind: 'line', revisionId: 5, itemId: 2, path: '/src/A.cs', firstLine: 1, lastLine: 1 } }),
      comment(4),
    ]);
    expect([...imagePinNumbers(threads)]).toEqual([[1, 1]]);
  });
});
