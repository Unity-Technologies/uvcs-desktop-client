import { describe, expect, it } from 'vitest';
import { sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { headerTop } from './geometry';
import { branchesNearView, lanesWithHeadersIn } from './headersInView';
import { laneHeaderHeight, laneShape } from './laneShape';

/** The sample's branches with ids of their own (the fixture gives them all 0), as the lists read them. */
function withBranchIds() {
  const history = sampleHistory();
  return { ...history, branches: history.branches.map((each, index) => ({ ...each, id: 100 + index })) };
}

const layout = layoutGraph(withBranchIds());
const EVERYTHING = { left: -1e6, top: -1e6, right: 1e6, bottom: 1e6 };

/** A small area around one lane's header, and nothing else's. */
function aroundHeaderOf(index: number) {
  const lane = layout.lanes[index]!;
  const shape = laneShape(lane);
  const top = headerTop(shape.y, laneHeaderHeight(lane));
  return { left: shape.left, right: shape.left + 1, top, bottom: top + 1 };
}

describe('lanesWithHeadersIn', () => {
  it('finds every lane in an area holding the whole graph', () => {
    expect(lanesWithHeadersIn(layout, EVERYTHING)).toHaveLength(layout.lanes.length);
  });

  it('finds none in an area away from the graph', () => {
    expect(lanesWithHeadersIn(layout, { left: -1e6, top: -1e6, right: -1e5, bottom: -1e5 })).toEqual([]);
  });

  it("finds a lane by its header's place, not its band's", () => {
    const area = aroundHeaderOf(1);
    expect(lanesWithHeadersIn(layout, area).map((lane) => lane.branch.id)).toContain(layout.lanes[1]!.branch.id);
  });
});

describe('branchesNearView', () => {
  it('takes in the headers within half a view of its edges, by branch id', () => {
    const lane = layout.lanes[1]!;
    const header = aroundHeaderOf(1);
    // A view of 100 px whose bottom edge is 40 px above the header: in its margin of 50.
    const above = { left: header.left - 50, right: header.left + 50, top: header.top - 140, bottom: header.top - 40 };
    expect(branchesNearView(layout, above)).toContain(lane.branch.id);
    // 60 px above it: past the margin.
    const farther = { ...above, top: header.top - 160, bottom: header.top - 60 };
    expect(branchesNearView(layout, farther)).not.toContain(lane.branch.id);
  });
});
