import { describe, expect, it } from 'vitest';
import { branch, changeset, sampleHistory } from '../model/graphFixtures';
import { layoutGraph, type GraphLayout } from '../model/layoutGraph';
import type { VisibleArea } from './drawContext';
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
