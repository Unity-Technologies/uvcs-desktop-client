import { describe, expect, it } from 'vitest';
import { everyVersionHas, framedBounds, nodesBounds } from './modelFraming';
import { modelSummary } from './modelSummary';
import { testModel } from './testing/testModels';

const lamp = (x: number) => modelSummary(testModel({ nodes: [{ name: 'Lamp', position: [x, 0, 0], mesh: {} }, { name: 'Shade', position: [x, 2, 0], mesh: {} }] }));

describe('framedBounds', () => {
  it('frames both versions together, in the viewer space (Unity X mirrored back)', () => {
    expect(framedBounds(lamp(0), lamp(3))).toEqual({ min: [-0.5, -0.5, -0.5], max: [3.5, 2.5, 0.5] });
  });

  it('frames the one version there is, and nothing when there is none', () => {
    expect(framedBounds(null, lamp(0))).toEqual({ min: [-0.5, -0.5, -0.5], max: [0.5, 2.5, 0.5] });
    expect(framedBounds(null, null)).toBeNull();
  });
});

describe('everyVersionHas', () => {
  it('waits for each version there is, so the first framing sees the pair as it will be laid out', () => {
    const both = { before: true, after: true };
    expect(everyVersionHas(both, { before: 'scene', after: null })).toBe(false);
    expect(everyVersionHas(both, { before: null, after: 'scene' })).toBe(false);
    expect(everyVersionHas(both, { before: 'scene', after: 'scene' })).toBe(true);
  });

  it("doesn't wait for a version there isn't (a model added or deleted)", () => {
    expect(everyVersionHas({ before: false, after: true }, { before: null, after: 'scene' })).toBe(true);
    expect(everyVersionHas({ before: true, after: false }, { before: null, after: null })).toBe(false);
    expect(everyVersionHas({ before: false, after: false }, { before: null, after: null })).toBe(true);
  });
});

describe('nodesBounds', () => {
  it('frames a node on each side it is on', () => {
    const shade = { name: 'Shade', path: 'Shade', kind: 'mesh' as const, before: 'Shade', after: 'Shade' };
    expect(nodesBounds([shade], lamp(0), lamp(3))).toEqual({ min: [-0.5, 1.5, -0.5], max: [3.5, 2.5, 0.5] });
    expect(nodesBounds([{ ...shade, before: undefined }], lamp(0), lamp(3))).toEqual({ min: [2.5, 1.5, -0.5], max: [3.5, 2.5, 0.5] });
  });
});
