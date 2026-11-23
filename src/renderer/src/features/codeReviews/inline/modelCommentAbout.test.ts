import { describe, expect, it } from 'vitest';
import { modelCommentAboutOf, spotAbout } from './modelCommentAbout';

const ON_WHEEL = { point: { x: 1, y: 2, z: 3 }, node: { path: ['Car', 'Wheel_FL'], local: { x: 0, y: 0, z: 0 } } };

describe('modelCommentAboutOf', () => {
  it("offers a point or its whole part, named, on a point of a part", () => {
    expect(modelCommentAboutOf(ON_WHEEL)).toEqual({ about: 'point', partName: 'Wheel_FL' });
    expect(modelCommentAboutOf({ ...ON_WHEEL, wholePart: true })).toEqual({ about: 'part', partName: 'Wheel_FL' });
  });

  it('offers nothing for a point on no part', () => {
    expect(modelCommentAboutOf({ point: { x: 1, y: 2, z: 3 } })).toBeNull();
  });
});

describe('spotAbout', () => {
  it('turns a point into its whole part and back, the point kept', () => {
    expect(spotAbout(ON_WHEEL, 'part')).toEqual({ ...ON_WHEEL, wholePart: true });
    expect(spotAbout({ ...ON_WHEEL, wholePart: true }, 'point')).toEqual(ON_WHEEL);
  });

  it('keeps a point on no part a point', () => {
    expect(spotAbout({ point: { x: 1, y: 2, z: 3 } }, 'part')).toEqual({ point: { x: 1, y: 2, z: 3 } });
  });
});
