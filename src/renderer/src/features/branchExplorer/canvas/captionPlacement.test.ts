import { describe, expect, it } from 'vitest';
import { sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { captionLeft, captionMiddle, captionRoom } from './captionPlacement';
import { BAND_HEIGHT, columnX, rowY } from './geometry';
import { nextColumnOnRow } from './rowNeighbors';

const layout = layoutGraph(sampleHistory());

describe('captionPlacement', () => {
  it('stops a comment before the next changeset on its row', () => {
    const node = layout.nodesByColumn.find((candidate) => nextColumnOnRow(layout, candidate.column) !== -1)!;
    const next = nextColumnOnRow(layout, node.column);
    expect(captionLeft(node) + captionRoom(layout, node)).toBeLessThan(columnX(next));
  });

  it('keeps the comment below the band at every zoom', () => {
    const node = layout.nodesByColumn[0]!;
    for (const zoom of [0.6, 1, 2.5]) {
      const bandBottom = (rowY(node.row) + BAND_HEIGHT / 2) * zoom;
      expect(captionMiddle(node, { panX: 0, panY: 0, zoom })).toBeGreaterThan(bandBottom + 6);
    }
  });
});
