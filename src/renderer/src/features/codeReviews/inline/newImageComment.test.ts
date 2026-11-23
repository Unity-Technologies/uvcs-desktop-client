import { describe, expect, it } from 'vitest';
import type { ShownFile } from './fileThreads';
import { imageCommentAt, imageCommentSide, newImageCommentSpot, newImageCommentsIn } from './newImageComment';

const HERO: ShownFile = { path: 'Art/Hero.png', originalRevision: 10, modifiedRevision: 30 };
const WHOLE = { kind: 'whole' } as const;

describe('imageCommentAt', () => {
  it("comments on the newer side's revision, or a deleted image's last one", () => {
    expect(imageCommentAt(WHOLE, HERO, { x: 1, y: 2 })).toEqual({ revisionId: 30, spot: { x: 1, y: 2 } });
    expect(imageCommentAt(WHOLE, { ...HERO, modifiedRevision: -1 }, { x: 1, y: 2 })).toEqual({ revisionId: 10, spot: { x: 1, y: 2 } });
  });

  it("goes in the changeset's diff it's written in", () => {
    expect(imageCommentAt({ kind: 'changeset', changesetId: 12 }, HERO, { x: 1, y: 2 })).toMatchObject({ changesetId: 12 });
  });

  it('takes none on a file with no revision to comment on', () => {
    expect(imageCommentAt(WHOLE, { ...HERO, modifiedRevision: -1, originalRevision: -1 }, { x: 1, y: 2 })).toBeNull();
  });
});

describe('newImageCommentSpot', () => {
  it('starts a change request, named by its review, file and spot', () => {
    const point = newImageCommentSpot(41, 'Art/Hero.png', 'additions', { revisionId: 30, spot: { x: 1, y: 2 } });
    const area = newImageCommentSpot(41, 'Art/Hero.png', 'additions', { revisionId: 30, spot: { x: 1, y: 2, size: { width: 3, height: 4 } } });
    expect(point.comment.kind).toBe('changeRequest');
    expect(point.key).not.toBe(area.key);
  });
});

describe('newImageCommentsIn', () => {
  const spot = newImageCommentSpot(41, 'Art/Hero.png', 'additions', { revisionId: 29, spot: { x: 1, y: 2 } });

  it("keeps the review's comments on the file, on the revision shown now", () => {
    expect(newImageCommentsIn([spot], 41, WHOLE, HERO)).toEqual([{ ...spot, comment: { ...spot.comment, revisionId: 30 } }]);
  });

  it("shows none of another review, file or changeset's diff", () => {
    expect(newImageCommentsIn([spot], 42, WHOLE, HERO)).toEqual([]);
    expect(newImageCommentsIn([spot], 41, WHOLE, { ...HERO, path: 'Art/Sky.png' })).toEqual([]);
    expect(newImageCommentsIn([spot], 41, { kind: 'changeset', changesetId: 3 }, HERO)).toEqual([]);
  });
});

describe('imageCommentSide', () => {
  it("takes comments on the newer side, a deleted image's older one, and none with no revision", () => {
    expect(imageCommentSide(HERO)).toBe('additions');
    expect(imageCommentSide({ ...HERO, modifiedRevision: -1 })).toBe('deletions');
    expect(imageCommentSide({ ...HERO, modifiedRevision: -1, originalRevision: -1 })).toBeNull();
  });
});
