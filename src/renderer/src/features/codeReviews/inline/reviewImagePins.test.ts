import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { imageThreadsOfFile, type ShownFile } from './fileThreads';
import { newImageCommentSpot } from './newImageComment';
import { newCommentPinKey, pinThreadId, reviewImagePinsOf, threadPinKey } from './reviewImagePins';

const HERO: ShownFile = { path: 'Art/Hero.png', originalRevision: 10, modifiedRevision: 30 };

function onImage(id: number, revisionId: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id,
    guid: `g${id}`,
    author: 'ana',
    date: '',
    text: `Look here ${id}`,
    kind: 'question',
    anchor: { kind: 'image', revisionId, itemId: 2, path: '/Art/Hero.png', spot: { x: id, y: 5 } },
    ...fields,
  };
}

function pinsOf(comments: ReviewComment[], options: { inCode?: boolean; focusThreadId?: number } = {}) {
  const threads = imageThreadsOfFile(threadsOf(comments), { kind: 'branch', branch: '/main/task' }, { kind: 'whole' }, HERO);
  return reviewImagePinsOf({ threads, spots: [], inCode: options.inCode ?? true, focusThreadId: options.focusThreadId, topSide: 'additions' });
}

describe('reviewImagePinsOf', () => {
  it('pins each thread at its spot on the side its revision shows, with who started it', () => {
    expect(pinsOf([onImage(1, 30), onImage(2, 10, { author: 'borja' })]).map(({ key, side, spot, author, earlier }) => ({ key, side, spot, author, earlier }))).toEqual([
      { key: 'thread:1', side: 'new', spot: { x: 1, y: 5 }, author: 'ana', earlier: false },
      { key: 'thread:2', side: 'old', spot: { x: 2, y: 5 }, author: 'borja', earlier: false },
    ]);
  });

  it('pins a thread on an earlier version on the newer image, marked earlier', () => {
    const [pin] = pinsOf([onImage(3, 20)]);
    expect(pin).toMatchObject({ side: 'new', earlier: true });
    expect(pin!.tip).toContain('Earlier version');
  });

  it('draws an open thread in the Open color, a settled one quiet', () => {
    const answered = [onImage(1, 30), onImage(9, 30, { kind: 'comment', parentId: 1, anchor: { kind: 'review' } })];
    expect(pinsOf([onImage(1, 30)])[0]!.emphasized).toBe(true);
    expect(pinsOf(answered)[0]!.emphasized).toBe(false);
  });

  it('shows only the thread gone to while comments are hidden', () => {
    expect(pinsOf([onImage(1, 30), onImage(2, 30)], { inCode: false })).toEqual([]);
    expect(pinsOf([onImage(1, 30), onImage(2, 30)], { inCode: false, focusThreadId: 2 }).map((pin) => pin.key)).toEqual(['thread:2']);
  });

  it('pins each comment being written, with no one yet', () => {
    const spot = newImageCommentSpot(41, 'Art/Hero.png', 'additions', { revisionId: 30, spot: { x: 4, y: 4, size: { width: 9, height: 9 } } });
    const pins = reviewImagePinsOf({ threads: { placed: [], earlier: [] }, spots: [spot], inCode: false, focusThreadId: undefined, topSide: 'additions' });
    expect(pins).toEqual([{ key: newCommentPinKey(spot.key), side: 'new', spot: spot.comment.spot, author: null, tip: 'New comment', emphasized: false, earlier: false }]);
  });
});

describe('pinThreadId', () => {
  it("reads a thread's pin back, and nothing else", () => {
    expect(pinThreadId(threadPinKey(42))).toBe(42);
    expect(pinThreadId(newCommentPinKey('41::a'))).toBeNull();
  });
});
