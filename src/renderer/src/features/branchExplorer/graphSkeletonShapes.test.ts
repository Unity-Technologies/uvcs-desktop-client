import { describe, expect, it } from 'vitest';
import { BAND_HEIGHT, columnX, COLUMN_WIDTH, headerTop, NODE_RADIUS, rowY } from './canvas/geometry';
import { graphSkeletonShapes } from './graphSkeletonShapes';

describe('graphSkeletonShapes', () => {
  const shapes = graphSkeletonShapes();

  it('puts each changeset on its band, at the graph’s own row and column spacing', () => {
    for (const node of shapes.nodes) {
      const band = shapes.bands.find((each) => node.y === each.y + BAND_HEIGHT / 2);
      expect(band).toBeDefined();
      expect(node.x).toBeGreaterThan(band!.x);
      expect(node.x).toBeLessThan(band!.x + band!.width);
      expect((node.x - columnX(0)) % COLUMN_WIDTH).toBe(0);
      expect(node.radius).toBe(NODE_RADIUS);
    }
    expect(new Set(shapes.bands.map((band) => band.y + BAND_HEIGHT / 2))).toEqual(new Set([0, 1, 2, 3].map(rowY)));
  });

  it('sits a header card on top of each band', () => {
    expect(shapes.headers.map((header) => header.y)).toEqual(shapes.bands.map((band) => headerTop(band.y + BAND_HEIGHT / 2)));
  });

  it('links each branch to the main one, ending where its band starts', () => {
    const forked = shapes.bands.slice(1);
    expect(shapes.links.map((link) => link.points[0]!.y)).toEqual(forked.map(() => rowY(0)));
    expect(shapes.links.map((link) => link.points.at(-1))).toEqual(forked.map((band) => ({ x: band.x, y: band.y + BAND_HEIGHT / 2 })));
  });
});
