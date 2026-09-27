import { describe, expect, it } from 'vitest';
import { branch, changeset, sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { columnX, graphSize, HEADER_HEIGHT, HEADER_MAX_WIDTH, headerTop, rowY, TWO_LINE_HEADER_HEIGHT } from './geometry';
import { labelChips } from './labelPlacement';
import { graphExtent, laneHeaderHeight, laneHeaderTop, laneShape } from './laneShape';
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

describe('labelChips', () => {
  it('stacks labels on the first columns of a branch above its header card', () => {
    const labeled = layoutGraph({
      ...sampleHistory(),
      labels: [{ name: 'early', changeset: 2, owner: '', date: '', comment: '' }],
    });
    const node = labeled.nodes.get(2)!;
    expect(labelChips(labeled, node)[0]!.top).toBeLessThan(headerTop(rowY(node.row)));
  });

  it('stacks them above a two-line header card too', () => {
    const history = sampleHistory();
    const labeled = layoutGraph({
      ...history,
      branches: history.branches.map((b) => (b.name === '/main/a' ? { ...b, comment: 'A comment' } : b)),
      labels: [{ name: 'early', changeset: 2, owner: '', date: '', comment: '' }],
    });
    const node = labeled.nodes.get(2)!;
    expect(labelChips(labeled, node)[0]!.top).toBeLessThan(laneHeaderTop(labeled.lanesByBranch.get('/main/a')!));
    expect(laneHeaderTop(labeled.lanesByBranch.get('/main/a')!)).toBe(headerTop(rowY(node.row), TWO_LINE_HEADER_HEIGHT));
  });

  const labelsOn = (id: number, names: string[]) => names.map((name) => ({ name, changeset: id, owner: '', date: '', comment: '' }));
  const ROW_ABOVE_COMMENTS = 24;

  it('stacks every label above the band while they stay clear of the comments of the row above', () => {
    const labeled = layoutGraph({ ...sampleHistory(), labels: labelsOn(6, ['a', 'b', 'c']) });
    const node = labeled.nodes.get(6)!;
    const chips = labelChips(labeled, node);
    expect(chips.map(({ text }) => text)).toEqual(['a', 'b', 'c']);
    expect(chips.at(-1)!.top).toBeGreaterThanOrEqual(rowY(node.row - 1) + 15 + ROW_ABOVE_COMMENTS);
  });

  it('counts the labels that do not fit on the last chip that does', () => {
    const labeled = layoutGraph({ ...sampleHistory(), labels: labelsOn(6, ['a', 'b', 'c', 'd', 'e']) });
    const chips = labelChips(labeled, labeled.nodes.get(6)!);
    expect(chips.map(({ text }) => text)).toEqual(['a', 'b', 'c +2']);
    expect(chips[2]!.more.map(({ name }) => name)).toEqual(['d', 'e']);
    expect(chips[0]!.more).toEqual([]);
  });

  it('keeps a single chip above a header card, counting the rest', () => {
    const history = sampleHistory();
    const labeled = layoutGraph({
      ...history,
      branches: history.branches.map((b) => (b.name === '/main/a' ? { ...b, comment: 'A comment' } : b)),
      labels: labelsOn(2, ['v2.1', 'v2', 'rc']),
    });
    const node = labeled.nodes.get(2)!;
    const chips = labelChips(labeled, node);
    expect(chips.map(({ text }) => text)).toEqual(['v2.1 +2']);
    expect(chips[0]!.top).toBeGreaterThanOrEqual(rowY(node.row - 1) + 15 + ROW_ABOVE_COMMENTS - 8);
  });
});

describe('graphExtent', () => {
  it('is the changesets with their padding when every header card fits', () => {
    const history = sampleHistory();
    const early = layoutGraph({ ...history, branches: history.branches.filter((b) => b.name !== '/main/b'), changesets: history.changesets.filter((c) => c.id !== 7) });
    expect(graphExtent(early)).toEqual(graphSize(early.columnCount, early.rowCount));
  });

  it('makes room for the whole header card of a branch starting at the end', () => {
    const history = sampleHistory();
    const withNewBranch = layoutGraph({ ...history, branches: [...history.branches, branch('/main/b/new', '/main/b', 7)] });
    const lane = withNewBranch.lanesByBranch.get('/main/b/new')!;
    expect(graphExtent(withNewBranch).width).toBeGreaterThanOrEqual(laneShape(lane).left + HEADER_MAX_WIDTH);
    expect(graphExtent(withNewBranch).height).toBe(graphSize(withNewBranch.columnCount, withNewBranch.rowCount).height);
  });
});
