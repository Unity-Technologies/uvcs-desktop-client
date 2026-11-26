import { describe, expect, it } from 'vitest';
import type { ShownFile } from './fileThreads';
import { newSpotComment, newSpotCommentsIn, spotCommentAt, spotCommentSide } from './newSpotComment';

const HERO: ShownFile = { path: 'Art/Hero.png', originalRevision: 10, modifiedRevision: 30 };
const WHOLE = { kind: 'whole' } as const;

describe('spotCommentAt', () => {
  it("comments on the newer side's revision, or a deleted image's last one", () => {
    expect(spotCommentAt(WHOLE, HERO, { x: 1, y: 2 })).toEqual({ revisionId: 30, spot: { x: 1, y: 2 } });
    expect(spotCommentAt(WHOLE, { ...HERO, modifiedRevision: -1 }, { x: 1, y: 2 })).toEqual({ revisionId: 10, spot: { x: 1, y: 2 } });
  });

  it("goes in the changeset's diff it's written in", () => {
    expect(spotCommentAt({ kind: 'changeset', changesetId: 12 }, HERO, { x: 1, y: 2 })).toMatchObject({ changesetId: 12 });
  });

  it('takes none on a file with no revision to comment on', () => {
    expect(spotCommentAt(WHOLE, { ...HERO, modifiedRevision: -1, originalRevision: -1 }, { x: 1, y: 2 })).toBeNull();
  });
});

describe('newSpotComment', () => {
  it('starts a change request, named by its serial, whatever spot it moves to', () => {
    const first = newSpotComment('image', 41, 'Art/Hero.png', 'additions', { revisionId: 30, spot: { x: 1, y: 2 } }, 1);
    const second = newSpotComment('image', 41, 'Art/Hero.png', 'additions', { revisionId: 30, spot: { x: 1, y: 2 } }, 2);
    expect(first.comment.kind).toBe('changeRequest');
    expect(first.key).not.toBe(second.key);
  });

  it("names a model's apart from an image's of the same serial", () => {
    const at = { revisionId: 30, spot: { point: { x: 0, y: 0, z: 0 } } };
    expect(newSpotComment('model', 41, 'Art/Car.fbx', 'additions', at, 1).key).not.toBe(newSpotComment('image', 41, 'Art/Car.fbx', 'additions', { revisionId: 30, spot: { x: 1, y: 2 } }, 1).key);
  });
});

describe('newSpotCommentsIn', () => {
  const spot = newSpotComment('image', 41, 'Art/Hero.png', 'additions', { revisionId: 29, spot: { x: 1, y: 2 } }, 1);

  it("keeps the review's comments on the file, on the revision shown now", () => {
    expect(newSpotCommentsIn([spot], 41, WHOLE, HERO)).toEqual([{ ...spot, comment: { ...spot.comment, revisionId: 30 } }]);
  });

  it("shows none of another review, file or changeset's diff", () => {
    expect(newSpotCommentsIn([spot], 42, WHOLE, HERO)).toEqual([]);
    expect(newSpotCommentsIn([spot], 41, WHOLE, { ...HERO, path: 'Art/Sky.png' })).toEqual([]);
    expect(newSpotCommentsIn([spot], 41, { kind: 'changeset', changesetId: 3 }, HERO)).toEqual([]);
  });
});

describe('spotCommentSide', () => {
  it("takes comments on the newer side, a deleted image's older one, and none with no revision", () => {
    expect(spotCommentSide(HERO)).toBe('additions');
    expect(spotCommentSide({ ...HERO, modifiedRevision: -1 })).toBe('deletions');
    expect(spotCommentSide({ ...HERO, modifiedRevision: -1, originalRevision: -1 })).toBeNull();
  });
});
