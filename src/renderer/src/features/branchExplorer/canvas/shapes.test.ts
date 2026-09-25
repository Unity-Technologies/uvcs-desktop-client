import { describe, expect, it } from 'vitest';
import { branch, changeset, sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { columnX, HEADER_HEIGHT, headerTop, rowY, TWO_LINE_HEADER_HEIGHT } from './geometry';
import { labelTop } from './labelPlacement';
import { laneHeaderHeight, laneHeaderTop, laneShape } from './laneShape';
import { nextColumnOnRow } from './rowNeighbors';

const layout = layoutGraph(sampleHistory());

describe('laneShape', () => {
  it('wraps the band around the branch’s own changesets, not its base', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    const shape = laneShape(lane);
    expect(shape.left).toBeLessThan(columnX(layout.nodes.get(2)!.column));
    expect(shape.left).toBeGreaterThan(columnX(layout.nodes.get(1)!.column));
    expect(shape.right).toBeGreaterThan(columnX(layout.nodes.get(5)!.column));
    expect(shape.y).toBe(rowY(lane.row));
  });

  it('gives a branch without changesets a short band after its base', () => {
    const empty = layoutGraph({
      branches: [branch('/main', '', 1), branch('/main/empty', '/main', 1)],
      changesets: [changeset(0, '/main', -1), changeset(1, '/main', 0)],
      mergeLinks: [],
      labels: [],
    });
    const shape = laneShape(empty.lanesByBranch.get('/main/empty')!);
    expect(shape.left).toBeGreaterThan(columnX(empty.nodes.get(1)!.column));
    expect(shape.right).toBeGreaterThan(shape.left);
  });
});

describe('laneHeaderHeight', () => {
  it('is two lines for a branch with a comment, one without', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    expect(laneHeaderHeight(lane)).toBe(HEADER_HEIGHT);
    expect(laneHeaderHeight({ ...lane, branch: { ...lane.branch, comment: 'Nitro boost\n\nDetails' } })).toBe(TWO_LINE_HEADER_HEIGHT);
  });
});

describe('nextColumnOnRow', () => {
  it('finds the next changeset on the same row, skipping other rows', () => {
    const column = layout.nodes.get(2)!.column;
    expect(nextColumnOnRow(layout, column)).toBe(layout.nodes.get(4)!.column);
  });

  it('is -1 for the last changeset of a row', () => {
    expect(nextColumnOnRow(layout, layout.nodes.get(6)!.column)).toBe(-1);
  });
});

describe('labelTop', () => {
  it('stacks labels on the first columns of a branch above its header card', () => {
    const labeled = layoutGraph({
      ...sampleHistory(),
      labels: [{ name: 'early', changeset: 2, owner: '', date: '', comment: '' }],
    });
    const node = labeled.nodes.get(2)!;
    expect(labelTop(labeled, node, 0)).toBeLessThan(headerTop(rowY(node.row)));
  });

  it('stacks them above a two-line header card too', () => {
    const history = sampleHistory();
    const labeled = layoutGraph({
      ...history,
      branches: history.branches.map((b) => (b.name === '/main/a' ? { ...b, comment: 'A comment' } : b)),
      labels: [{ name: 'early', changeset: 2, owner: '', date: '', comment: '' }],
    });
    const node = labeled.nodes.get(2)!;
    expect(labelTop(labeled, node, 0)).toBeLessThan(laneHeaderTop(labeled.lanesByBranch.get('/main/a')!));
    expect(laneHeaderTop(labeled.lanesByBranch.get('/main/a')!)).toBe(headerTop(rowY(node.row), TWO_LINE_HEADER_HEIGHT));
  });
});
