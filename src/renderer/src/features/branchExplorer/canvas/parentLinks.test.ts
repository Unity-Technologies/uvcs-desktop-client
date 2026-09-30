import { describe, expect, it } from 'vitest';
import { branch, changeset, largeHistory, sampleHistory } from '../model/graphFixtures';
import { layoutGraph, type GraphLayout } from '../model/layoutGraph';
import type { VisibleArea } from './drawContext';
import { countedReads } from '@shared/testing/countedReads';
import { columnX, rowY } from './geometry';
import { hasParentOffGraph, parentLinksInView } from './parentLinks';

/** The screen showing world columns `first` to `last` and rows `top` to `bottom`, with no apron. */
function view(first: number, last: number, top = 0, bottom = 3): VisibleArea {
  return { left: columnX(first), right: columnX(last), top: rowY(top), bottom: rowY(bottom), firstColumn: first, lastColumn: last };
}

const linkIds = (layout: GraphLayout, visible: VisibleArea): string[] =>
  parentLinksInView(layout, visible, 0).map(({ parent, child }) => `${parent.changeset.id}->${child.changeset.id}`);

describe('parentLinksInView', () => {
  // /main/a: 2 (column 2) ─── 4 (column 4); column 3 is /main's changeset 3.
  it('keeps the line between two changesets that are both off screen', () => {
    const layout = layoutGraph(sampleHistory());
    expect(linkIds(layout, view(3, 3))).toContain('2->4');
  });

  it('keeps the line when only its parent is on screen', () => {
    const layout = layoutGraph(sampleHistory());
    expect(linkIds(layout, view(2, 3))).toContain('2->4');
  });

  it('skips lines entirely left or right of the screen', () => {
    const layout = layoutGraph(sampleHistory());
    expect(linkIds(layout, view(5, 7))).not.toContain('2->4');
    expect(linkIds(layout, view(0, 1))).not.toContain('2->4');
  });

  it('skips lines on rows above or below the screen', () => {
    const layout = layoutGraph(sampleHistory());
    expect(linkIds(layout, view(0, 7, 1.5, 3))).toEqual([]);
  });

  it('never links a branch start: that is the elbow from its base', () => {
    const layout = layoutGraph(sampleHistory());
    expect(linkIds(layout, view(0, 7))).not.toContain('1->2');
  });

  it('finds the lines on screen of a 100,000-changeset history', () => {
    const layout = layoutGraph(largeHistory(100_000, 20_000));
    const everyLink = layout.nodesByColumn.flatMap((child) => {
      const parent = layout.nodes.get(child.changeset.parent);
      return parent && parent.changeset.branch === child.changeset.branch ? [`${parent.changeset.id}->${child.changeset.id}`] : [];
    });
    const screen = view(1_000, 1_030, 0, 80);
    const expected = everyLink.filter((link) => {
      const [parent, child] = link.split('->').map((id) => layout.nodes.get(Number(id))!.column);
      return child! >= 1_000 && parent! <= 1_030;
    });
    expect(linkIds(layout, screen)).toEqual(expected);

  });

  it('reads only the changesets on screen and one past it per row, frame after frame, however long the history', () => {
    const readsPerFrame = (changesets: number): number => {
      const full = layoutGraph(largeHistory(changesets, changesets / 5));
      const { items, reads } = countedReads(full.nodesByColumn);
      const layout = { ...full, nodesByColumn: items };
      // The first frame indexes the rows once per layout.
      parentLinksInView(layout, view(0, 30, 0, 80), 0);
      const before = reads();
      for (let frame = 0; frame < 2_000; frame++) parentLinksInView(layout, view(frame, frame + 30, 0, 80), 0);
      return (reads() - before) / 2_000;
    };
    const perFrame = readsPerFrame(25_000);
    expect(perFrame).toBeLessThan(40 * (31 + 81));
    expect(readsPerFrame(50_000) / perFrame).toBeLessThan(1.3);
  });
});

describe('hasParentOffGraph', () => {
  it('marks the first loaded changeset of a branch whose parent is older than the loaded dates', () => {
    const layout = layoutGraph({
      branches: [branch('/main', '', 11), branch('/main/task', '/main', 12)],
      changesets: [changeset(10, '/main', 9), changeset(11, '/main', 10), changeset(12, '/main/task', 3)],
      mergeLinks: [],
      labels: [],
    });
    const offGraph = layout.nodesByColumn.filter((node) => hasParentOffGraph(layout, node)).map((node) => node.changeset.id);
    expect(offGraph).toEqual([10, 12]);
  });

  it('leaves the root changeset alone', () => {
    const layout = layoutGraph(sampleHistory());
    expect(layout.nodesByColumn.some((node) => hasParentOffGraph(layout, node))).toBe(false);
  });
});
