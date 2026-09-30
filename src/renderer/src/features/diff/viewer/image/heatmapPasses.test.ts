import { describe, expect, it } from 'vitest';
import { heatmapPasses } from './heatmapPasses';
import { bitmap, opaque } from './testBitmaps';

const OLD = bitmap(2, 1, [opaque(0, 0, 0), opaque(10, 10, 10)]);
const NEW = bitmap(2, 1, [opaque(0, 0, 0), opaque(250, 250, 250)]);

describe('heatmapPasses', () => {
  it('compares a pair: its heatmap, changed regions and histogram', () => {
    const compared = heatmapPasses().compare('pair', OLD, NEW, 'center', 0);
    expect(compared).toMatchObject({ width: 2, height: 1, coveredPixels: 2, regions: [{ x: 1, y: 0, width: 1, height: 1, pixels: 1 }] });
    expect(compared.pixels).toHaveLength(8);
    expect(compared.histogram[240]).toBe(1);
  });

  it('renders the pair it keeps at another tolerance, without comparing it again', () => {
    const passes = heatmapPasses();
    passes.compare('pair', OLD, NEW, 'center', 0);
    expect(passes.rerender('pair', 255)?.regions).toEqual([]);
    expect(passes.rerender('pair', 0)?.regions).toHaveLength(1);
  });

  it('keeps only the last pair compared', () => {
    const passes = heatmapPasses();
    passes.compare('first', OLD, NEW, 'center', 0);
    passes.compare('second', OLD, NEW, 'center', 0);
    expect(passes.rerender('first', 0)).toBeNull();
    expect(passes.rerender('second', 0)).not.toBeNull();
  });
});
