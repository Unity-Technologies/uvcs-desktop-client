import { describe, expect, it } from 'vitest';
import { modelStats } from './modelStats';
import { modelSummary } from './modelSummary';
import { testModel } from './testing/testModels';

const crate = modelSummary(testModel({ nodes: [{ name: 'Crate', mesh: { size: [1, 0.5, 0.25], slots: ['Wood', 'Metal'] } }] }));
const robot = modelSummary(testModel({ nodes: [{ name: 'Hips', kind: 'bone' }, { name: 'Body', mesh: { size: [0.5, 1.8, 0.3] } }], clips: [{ name: 'Idle', duration: 2 }] }));

describe('modelStats', () => {
  it("gives a version's figures, leaving out the kinds it has none of", () => {
    expect(modelStats(null, crate)).toEqual([
      { label: 'Tris', before: null, after: '12', tip: 'Triangles' },
      { label: 'Verts', before: null, after: '24', tip: expect.stringContaining('as Unity counts them') },
      { label: 'Materials', before: null, after: '2', tip: 'Material slots' },
      { label: 'Size', before: null, after: '1 × 0.5 × 0.25 m', tip: 'Width × height × depth in Unity' },
    ]);
  });

  it('gives both versions where either has the kind', () => {
    const stats = modelStats(crate, robot);
    expect(stats.find((stat) => stat.label === 'Bones')).toEqual({ label: 'Bones', before: null, after: '1' });
    expect(stats.find((stat) => stat.label === 'Size')).toMatchObject({ before: '1 × 0.5 × 0.25 m', after: '0.5 × 1.8 × 0.3 m' });
  });

  it('gives both sizes in one unit, the one that reads the larger', () => {
    const pebble = modelSummary(testModel({ nodes: [{ name: 'Pebble', mesh: { size: [0.04, 0.02, 0.03] } }] }));
    expect(modelStats(pebble, crate).find((stat) => stat.label === 'Size')).toMatchObject({ before: '0.04 × 0.02 × 0.03 m', after: '1 × 0.5 × 0.25 m' });
    const speck = modelSummary(testModel({ nodes: [{ name: 'Speck', mesh: { size: [0.009, 0.0045, 0.0123] } }] }));
    expect(modelStats(speck, crate).find((stat) => stat.label === 'Size')?.before).toBe('0.009 × 0.0045 × 0.0123 m');
  });
});
