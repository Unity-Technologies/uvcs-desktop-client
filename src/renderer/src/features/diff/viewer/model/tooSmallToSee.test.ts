import { describe, expect, it } from 'vitest';
import { dolliedTo, framedView, type BoundsLike } from './orbitCamera';
import { tooSmallToSee, tooSmallWords } from './tooSmallToSee';

/** A mech 4.4 m tall, standing on the origin, `scale` times its size. */
const mech = (scale: number): BoundsLike => ({ min: [-1.2 * scale, 0, -0.8 * scale], max: [1.2 * scale, 4.4 * scale, 0.8 * scale] });
const union = (a: BoundsLike, b: BoundsLike): BoundsLike => ({
  min: a.min.map((value, i) => Math.min(value, b.min[i]!)) as BoundsLike['min'],
  max: a.max.map((value, i) => Math.max(value, b.max[i]!)) as BoundsLike['max'],
});
/** Split's halves: each about as wide as the stage is high. */
const HALF_ASPECT = 0.9;
const STAGE_HEIGHT = 600;

describe('tooSmallToSee', () => {
  it('finds the version a hundred times smaller, which the framing of both leaves a speck beside the other', () => {
    const [fixed, tooBig] = [mech(1), mech(100)];
    const view = framedView(union(fixed, tooBig), HALF_ASPECT);
    expect(tooSmallToSee({ before: tooBig, after: fixed }, view, STAGE_HEIGHT)).toEqual({ side: 'after', times: 100 });
    expect(tooSmallToSee({ before: fixed, after: tooBig }, view, STAGE_HEIGHT)).toEqual({ side: 'before', times: 100 });
  });

  it('finds none where both show: of sizes alike, or framed on the small one', () => {
    expect(tooSmallToSee({ before: mech(1), after: mech(1.5) }, framedView(union(mech(1), mech(1.5)), HALF_ASPECT), STAGE_HEIGHT)).toBeNull();
    expect(tooSmallToSee({ before: mech(100), after: mech(1) }, framedView(mech(1), HALF_ASPECT), STAGE_HEIGHT)).toBeNull();
  });

  it('finds none where neither shows, or one version is all there is', () => {
    const far = dolliedTo(framedView(union(mech(1), mech(100)), HALF_ASPECT), 1e6, null);
    expect(tooSmallToSee({ before: mech(100), after: mech(1) }, far, STAGE_HEIGHT)).toBeNull();
    expect(tooSmallToSee({ before: null, after: mech(1) }, framedView(mech(1), HALF_ASPECT), STAGE_HEIGHT)).toBeNull();
  });

  it('finds none behind the camera, which shows nothing of it at any size', () => {
    const insideTheBigOne = { target: [0, 220, 0] as [number, number, number], yaw: Math.PI, pitch: 0, distance: 1 };
    expect(tooSmallToSee({ before: mech(100), after: mech(1) }, insideTheBigOne, STAGE_HEIGHT)).toBeNull();
  });
});

describe('tooSmallWords', () => {
  it('says how much smaller, in whole times from ten', () => {
    expect(tooSmallWords(100)).toBe('100× smaller: too small to see at this size');
    expect(tooSmallWords(12.4)).toBe('12× smaller: too small to see at this size');
    expect(tooSmallWords(7.25)).toBe('7.3× smaller: too small to see at this size');
  });
});
