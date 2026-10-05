import { describe, expect, it } from 'vitest';
import { framedBounds, nodesBounds } from './modelFraming';
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

describe('nodesBounds', () => {
  it('frames a node on each side it is on', () => {
    const shade = { name: 'Shade', path: 'Shade', kind: 'mesh' as const, before: 'Shade', after: 'Shade' };
    expect(nodesBounds([shade], lamp(0), lamp(3))).toEqual({ min: [-0.5, 1.5, -0.5], max: [3.5, 2.5, 0.5] });
    expect(nodesBounds([{ ...shade, before: undefined }], lamp(0), lamp(3))).toEqual({ min: [2.5, 1.5, -0.5], max: [3.5, 2.5, 0.5] });
  });
});
