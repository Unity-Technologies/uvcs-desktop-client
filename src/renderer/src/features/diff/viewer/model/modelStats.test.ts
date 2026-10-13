import { describe, expect, it } from 'vitest';
import type { TextureIssue } from './materials/materialPlan';
import { modelStats, movedStat, texturesStat } from './modelStats';
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

describe('movedStat', () => {
  const comparison = (after: number[], before: number[] = [0]) => ({ before: [new Float32Array(before)], after: [new Float32Array(after)], size: 10, maxDistance: 1 });

  it('tells the share that moved past the tolerance, and the farthest', () => {
    expect(movedStat(comparison([0, 0, 0, 0.042]), 0.001).after).toBe('25% · up to 4.2 cm');
  });

  it('tells a part that came or went as farther than the measure goes', () => {
    expect(movedStat(comparison([0, 1]), 0.001).after).toBe('50% · up to 1 m+');
  });

  it('tells a tiny share as under 1%, and nothing moved as None', () => {
    expect(movedStat(comparison([...Array(999).fill(0), 0.5]), 0.001).after).toBe('<1% · up to 50 cm');
    expect(movedStat(comparison([0, 0.0005]), 0.001).after).toBe('None');
  });
});

describe('texturesStat', () => {
  it('counts the textures that show, naming the first eight that don\'t and why', () => {
    const issues: TextureIssue[] = Array.from({ length: 10 }, (_, i) => ({ name: `gone${i}.png`, problem: 'missing' }));
    issues[1] = { name: 'bark.psd', problem: 'psdWithoutComposite' };
    const stat = texturesStat({ total: 22, shown: 12, loading: 0, downloading: 0, issues });
    expect(stat).toMatchObject({ label: 'Textures', before: null, after: '12 of 22' });
    expect(stat!.tip!.split('\n')).toEqual([
      'Textures shown',
      'gone0.png: not found where Unity looks',
      "bark.psd: can't read this PSD: save it with Maximize Compatibility",
      ...[2, 3, 4, 5, 6, 7].map((i) => `gone${i}.png: not found where Unity looks`),
      'and 2 more',
    ]);
  });

  it('reads "12" when all show, counts up while they load, says how many come from the repository, and shows nothing without textures', () => {
    expect(texturesStat({ total: 12, shown: 12, loading: 0, downloading: 0, issues: [] })?.after).toBe('12');
    expect(texturesStat({ total: 3, shown: 1, loading: 2, downloading: 0, issues: [] })).toMatchObject({ after: '1 of 3…', tip: expect.stringContaining('Loading 2…') });
    const downloading = texturesStat({ total: 5, shown: 1, loading: 4, downloading: 3, issues: [] })!;
    expect(downloading.after).toBe('1 of 5…');
    expect(downloading.tip!.split('\n')).toEqual(['Textures shown', 'Getting 3 from the repository…', 'Loading 1…']);
    expect(texturesStat({ total: 0, shown: 0, loading: 0, downloading: 0, issues: [] })).toBeNull();
  });
});
