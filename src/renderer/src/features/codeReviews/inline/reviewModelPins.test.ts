import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { modelThreadsOfFile, type ShownFile } from './fileThreads';
import { newSpotComment } from './newSpotComment';
import { reviewModelPinsOf } from './reviewModelPins';
import { newCommentPinKey } from './reviewPins';

const CAR: ShownFile = { path: 'Art/Car.fbx', originalRevision: 10, modifiedRevision: 30 };

function onModel(id: number, revisionId: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id,
    guid: `g${id}`,
    author: 'ana',
    date: '',
    text: `Look here ${id}`,
    kind: 'question',
    anchor: { kind: 'model', revisionId, itemId: 2, path: '/Art/Car.fbx', spot: { point: { x: id, y: 0, z: 0 }, node: { path: ['Car', 'Body'], local: { x: 0, y: 0, z: 0 } } } },
    ...fields,
  };
}

function pinsOf(comments: ReviewComment[], options: { inCode?: boolean; focusThreadId?: number } = {}) {
  const threads = modelThreadsOfFile(threadsOf(comments), { kind: 'branch', branch: '/main/task' }, { kind: 'whole' }, CAR);
  return reviewModelPinsOf({ threads, spots: [], inCode: options.inCode ?? true, focusThreadId: options.focusThreadId, topSide: 'additions' });
}

describe('reviewModelPinsOf', () => {
  it('pins each thread at its spot on the version its revision shows, with who started it, where it stays', () => {
    expect(pinsOf([onModel(1, 30), onModel(2, 10, { author: 'borja' })]).map(({ key, side, author, earlier, movable }) => ({ key, side, author, earlier, movable }))).toEqual([
      { key: 'thread:1', side: 'after', author: 'ana', earlier: false, movable: false },
      { key: 'thread:2', side: 'before', author: 'borja', earlier: false, movable: false },
    ]);
  });

  it("puts a thread on an earlier version on the side comments go on, dashed, its tooltip saying so", () => {
    const [pin] = pinsOf([onModel(3, 20)]);
    expect(pin).toMatchObject({ side: 'after', earlier: true });
    expect(pin!.tip).toContain('Earlier version');
  });

  it('marks what is still open', () => {
    const answered = [onModel(1, 30), { ...onModel(2, 30), parentId: 1, kind: 'comment' as const }];
    expect(pinsOf([onModel(1, 30)])[0]!.emphasized).toBe(true);
    expect(pinsOf(answered)[0]!.emphasized).toBe(false);
  });

  it('shows only the thread gone to while comments are hidden', () => {
    expect(pinsOf([onModel(1, 30), onModel(2, 30)], { inCode: false, focusThreadId: 2 }).map((pin) => pin.key)).toEqual(['thread:2']);
  });

  it('pins each comment being written with a plus, movable', () => {
    const spot = newSpotComment('model', 41, 'Art/Car.fbx', 'additions', { revisionId: 30, spot: { point: { x: 1, y: 2, z: 3 } } }, 1);
    const threads = modelThreadsOfFile([], { kind: 'branch', branch: '/main/task' }, { kind: 'whole' }, CAR);
    expect(reviewModelPinsOf({ threads, spots: [spot], inCode: false, focusThreadId: undefined, topSide: 'additions' })).toEqual([
      { key: newCommentPinKey(spot.key), side: 'after', spot: spot.comment.spot, author: null, tip: 'New comment: drag it over the model to move it', emphasized: false, earlier: false, movable: true },
    ]);
  });
});
