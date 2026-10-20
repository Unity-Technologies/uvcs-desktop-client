import { BAND_HEIGHT, COLUMN_WIDTH, columnX, HEADER_HEIGHT, HEADER_INSET, headerTop, NODE_RADIUS, rowY } from './canvas/geometry';

/**
 * The Branch Explorer while its history is read: a few branches drawn with the graph's own measurements (rows, columns,
 * bands, header cards, changesets), at zoom 1, so what loads takes their place. A fixed pattern, not a guess at the
 * history: a main branch across, three short ones off it. The main one takes row 0, as `layoutGraph` lays `/main` out
 * (`layoutGraph.test.ts`), so the real one lands where its placeholder was.
 */
export interface GraphSkeletonShapes {
  bands: Rect[];
  headers: Rect[];
  nodes: { x: number; y: number; radius: number }[];
  /** From the main branch down to each branch it forks, then along to where the branch's band starts. */
  links: { points: { x: number; y: number }[] }[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SkeletonBranch {
  row: number;
  /** The changesets' columns, in order; the band runs from the first to the last. */
  columns: number[];
  /** The main branch's column it forks from. */
  forkedAt?: number;
  /** How many columns its header card spans. */
  headerColumns: number;
}

const BRANCHES: SkeletonBranch[] = [
  { row: 0, columns: [0, 2, 3, 5, 7, 8, 10], headerColumns: 2 },
  { row: 1, columns: [3, 4], forkedAt: 2, headerColumns: 3 },
  { row: 2, columns: [6, 7, 8], forkedAt: 5, headerColumns: 3 },
  { row: 3, columns: [1, 2], forkedAt: 0, headerColumns: 2 },
];

/** How far a band reaches past its first and last changesets, as a real one does. */
const BAND_REACH = NODE_RADIUS + 8;

export function graphSkeletonShapes(): GraphSkeletonShapes {
  const shapes: GraphSkeletonShapes = { bands: [], headers: [], nodes: [], links: [] };
  for (const { row, columns, forkedAt, headerColumns } of BRANCHES) {
    const y = rowY(row);
    const left = columnX(columns[0]!) - BAND_REACH;
    const right = columnX(columns.at(-1)!) + BAND_REACH;
    shapes.bands.push({ x: left, y: y - BAND_HEIGHT / 2, width: right - left, height: BAND_HEIGHT });
    shapes.headers.push({ x: left + HEADER_INSET, y: headerTop(y), width: headerColumns * COLUMN_WIDTH - HEADER_INSET, height: HEADER_HEIGHT });
    for (const column of columns) shapes.nodes.push({ x: columnX(column), y, radius: NODE_RADIUS });
    if (forkedAt !== undefined) {
      const x = columnX(forkedAt);
      shapes.links.push({ points: [{ x, y: rowY(0) }, { x, y }, { x: left, y }] });
    }
  }
  return shapes;
}
