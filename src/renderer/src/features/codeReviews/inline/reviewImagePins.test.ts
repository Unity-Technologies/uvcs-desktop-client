import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { imageThreadsOfFile, type ShownFile } from './fileThreads';
import { newSpotComment } from './newSpotComment';
import { reviewImagePinsOf } from './reviewImagePins';
import { newCommentPinKey, openedPin, pinRevealedBy, pinThreadId, spotThreadIdsOf, spotThreadOf, threadPinKey } from './reviewPins';

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
  it('pins each thread at its spot on the side its revision shows, with who started it, where it stays', () => {
    expect(pinsOf([onImage(1, 30), onImage(2, 10, { author: 'borja' })]).map(({ key, side, spot, author, earlier, movable }) => ({ key, side, spot, author, earlier, movable }))).toEqual([
      { key: 'thread:1', side: 'new', spot: { x: 1, y: 5 }, author: 'ana', earlier: false, movable: false },
      { key: 'thread:2', side: 'old', spot: { x: 2, y: 5 }, author: 'borja', earlier: false, movable: false },
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
    const spot = newSpotComment('image', 41, 'Art/Hero.png', 'additions', { revisionId: 30, spot: { x: 4, y: 4, size: { width: 9, height: 9 } } }, 1);
    const pins = reviewImagePinsOf({ threads: { placed: [], earlier: [] }, spots: [spot], inCode: false, focusThreadId: undefined, topSide: 'additions' });
    expect(pins).toEqual([{ key: newCommentPinKey(spot.key), side: 'new', spot: spot.comment.spot, author: null, tip: 'New comment: drag to move it', emphasized: false, earlier: false, movable: true }]);
  });
});

describe('pinThreadId', () => {
  it("reads a thread's pin back, and nothing else", () => {
    expect(pinThreadId(threadPinKey(42))).toBe(42);
    expect(pinThreadId(newCommentPinKey('41::a'))).toBeNull();
  });
});

describe('the threads of an image', () => {
  const threads = imageThreadsOfFile(threadsOf([onImage(1, 30), onImage(2, 20)]), { kind: 'branch', branch: '/main/task' }, { kind: 'whole' }, HERO);

  it('finds a thread, and whether it is on an earlier version', () => {
    expect(spotThreadOf(threads, 1)?.earlier).toBe(false);
    expect(spotThreadOf(threads, 2)?.earlier).toBe(true);
    expect(spotThreadOf(threads, 9)).toBeNull();
    expect([...spotThreadIdsOf(threads)]).toEqual([1, 2]);
    expect(spotThreadIdsOf(null).size).toBe(0);
  });

  it('reveals the pin of a thread gone to, once', () => {
    expect(pinRevealedBy({ threadId: 2, seq: 5 }, threads, undefined)).toEqual({ key: 'thread:2', seq: 5 });
    expect(pinRevealedBy({ threadId: 2, seq: 5 }, threads, 5)).toBeNull();
  });

  it('reveals none for a thread picked in place, or of another file', () => {
    expect(pinRevealedBy({ threadId: 2, seq: 6, inPlace: true }, threads, 5)).toBeNull();
    expect(pinRevealedBy({ threadId: 9, seq: 6 }, threads, 5)).toBeNull();
    expect(pinRevealedBy(null, threads, 5)).toBeNull();
  });
});

describe('openedPin', () => {
  const pins = pinsOf([onImage(1, 30)]);

  it("is the pin opened in this file while it's there", () => {
    expect(openedPin(pins, { path: 'Art/Hero.png', key: 'thread:1' }, 'Art/Hero.png')).toBe('thread:1');
  });

  it('is none in another file, or once its pin is gone', () => {
    expect(openedPin(pins, { path: 'Art/Sky.png', key: 'thread:1' }, 'Art/Hero.png')).toBeNull();
    expect(openedPin(pins, { path: 'Art/Hero.png', key: 'thread:7' }, 'Art/Hero.png')).toBeNull();
  });
});
