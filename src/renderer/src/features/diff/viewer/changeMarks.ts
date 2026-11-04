import { formatCount } from '../../../lib/text';
import type { ChangedLine, ChangeRegion, DiffSide } from './changeBlocks';

/**
 * The change map: the diff's own vertical scrollbar marks where its changes are in its track (`ChangeMap`), so the
 * shape of the whole diff reads at a glance and a click there scrolls to it. The track stands for the whole
 * scrolling content: a change at a share of the content's height is marked at that share of the track's. Each change
 * is a solid block, and changes close together fuse into one band, so the clear gaps between bands show where the
 * groups of changes are.
 */

/** What a mark's changes do: only add lines, only remove lines, or both (drawn half removed, half added). */
export type ChangeMarkKind = 'added' | 'deleted' | 'both';

/** A block of the track, in its pixels: one change, or several close together fused into a band (`first` to `last`). */
export interface ChangeMark {
  kind: ChangeMarkKind;
  top: number;
  height: number;
  /** The first change it stands for, by index; its tooltip counts from it ("Changes 4–24 of 25"). */
  first: number;
  last: number;
}

/** Where a line sits in the diff's scrolling content, and how tall it's laid out (all the rows of a wrapped line). */
export interface LineBox {
  top: number;
  height: number;
}

export interface ChangeMapLayout {
  /**
   * Where a line is laid out (Pierre's virtualizer, `pierreLineBox`: collapsed unchanged lines and wrapped lines
   * counted), or undefined when it can't tell yet: the line is then placed at its share of its side's lines.
   */
  boxOf: (line: ChangedLine) => LineBox | undefined;
  /** How many lines each side has, for a line Pierre can't place. */
  lineCounts: Record<DiffSide, number>;
  /** The scrolling content's height (`scrollHeight`). */
  contentHeight: number;
  /** The track's height, which stands for the whole content. */
  trackHeight: number;
}

/** A block is never shorter than this, so a change of one line reads as a block, not a speck, and can be clicked. */
export const MIN_MARK_HEIGHT = 4;

/** Changes whose blocks are closer than this fuse into one band: the gaps left are the ones the eye can read. */
export const FUSE_GAP = 4;

/**
 * Changes this few unchanged lines apart, or fewer, fuse into one band however far apart the diff lays them out: they
 * read as one group of edits (a run of one-line edits a couple of lines apart), as the hunk around them shows them.
 */
export const FUSE_LINES = 3;

/** Whether the map shows: a diff of two versions that has changes and doesn't fit without scrolling. */
export function showsChangeMap({ changes, bothSides, contentHeight, viewHeight }: { changes: number; bothSides: boolean; contentHeight: number; viewHeight: number }): boolean {
  // A version shown alone (an added or deleted file) is one change, the whole text: nothing to map.
  return changes > 0 && bothSides && viewHeight > 0 && contentHeight > viewHeight + 1;
}

export function changeKindOf(region: ChangeRegion): ChangeMarkKind {
  const removes = region.lines.some((line) => line.side === 'deletions');
  const adds = region.lines.some((line) => line.side === 'additions');
  return removes && adds ? 'both' : removes ? 'deleted' : 'added';
}

/**
 * The blocks of the changes, top to bottom. Changes whose blocks touch or are less than `FUSE_GAP` apart, or with at
 * most `FUSE_LINES` unchanged lines between them, fuse into one band, of one kind if they all are, else `both`; so however many changes a file has, the marks are at most one for
 * every `MIN_MARK_HEIGHT` pixels of the track: what's drawn is bounded by the track, not the file. Each change asks
 * where at most four lines are (the first and last of each side).
 */
export function changeMarks(regions: readonly ChangeRegion[], layout: ChangeMapLayout): ChangeMark[] {
  const { contentHeight, trackHeight } = layout;
  if (contentHeight <= 0 || trackHeight <= 0) return [];
  const scale = trackHeight / contentHeight;
  const marks: ChangeMark[] = [];
  let previousEnd = -Infinity;
  for (const region of regions) {
    const span = regionSpan(region, layout);
    const height = Math.min(trackHeight, Math.max(MIN_MARK_HEIGHT, Math.ceil(span.bottom * scale) - Math.floor(span.top * scale)));
    const top = Math.min(Math.max(0, Math.floor(span.top * scale)), trackHeight - height);
    const kind = changeKindOf(region);
    const previous = marks.at(-1);
    const linesBetween = region.newStart - previousEnd;
    previousEnd = modifiedEnd(region);
    if (previous && (top < previous.top + previous.height + FUSE_GAP || linesBetween <= FUSE_LINES)) {
      previous.height = Math.max(previous.top + previous.height, top + height) - previous.top;
      previous.kind = previous.kind === kind ? kind : 'both';
      previous.last = region.index;
    } else {
      marks.push({ kind, top, height, first: region.index, last: region.index });
    }
  }
  return marks;
}

/** The modified line just past a change: where the unchanged lines after it start. */
function modifiedEnd(region: ChangeRegion): number {
  return region.newStart + region.lines.filter((line) => line.side === 'additions').length;
}

/** Where a change's rows start and end in the content: from its first lines' tops to its last lines' bottoms. */
function regionSpan(region: ChangeRegion, layout: ChangeMapLayout): { top: number; bottom: number } {
  const boxes = sideEnds(region.lines).map((line) => layout.boxOf(line) ?? shareOfSide(line, layout));
  return { top: Math.min(...boxes.map((box) => box.top)), bottom: Math.max(...boxes.map((box) => box.top + box.height)) };
}

/** The first and last line of each side the change has: side by side, either side may start higher or end lower. */
function sideEnds(lines: readonly ChangedLine[]): ChangedLine[] {
  const ends: ChangedLine[] = [];
  for (const side of ['deletions', 'additions'] as const) {
    const first = lines.find((line) => line.side === side);
    const last = lines.findLast((line) => line.side === side);
    if (first) ends.push(first);
    if (last && last !== first) ends.push(last);
  }
  return ends;
}

function shareOfSide({ side, lineNumber }: ChangedLine, { lineCounts, contentHeight }: ChangeMapLayout): LineBox {
  const lines = Math.max(1, lineCounts[side]);
  return { top: ((lineNumber - 1) / lines) * contentHeight, height: contentHeight / lines };
}

/**
 * Where a click on the track at `y` scrolls the view: so the point of the content it stands for is in the middle of the
 * view, within the content's ends. A click on a block or between blocks alike: one rule the eye can predict, while the
 * arrows (⌥↓ ⌥↑) step from change to change.
 */
export function scrollTopForTrackPoint(y: number, { contentHeight, trackHeight, viewHeight }: { contentHeight: number; trackHeight: number; viewHeight: number }): number {
  const point = trackHeight > 0 ? (y / trackHeight) * contentHeight : 0;
  return Math.round(Math.min(Math.max(0, point - viewHeight / 2), Math.max(0, contentHeight - viewHeight)));
}

/** A mark's tooltip: "Change 3 of 12", or "Changes 3–5 of 12" for changes too close to tell apart. */
export function changeMarkLabel(mark: ChangeMark, count: number): string {
  const total = formatCount(count);
  return mark.first === mark.last ? `Change ${formatCount(mark.first + 1)} of ${total}` : `Changes ${formatCount(mark.first + 1)}–${formatCount(mark.last + 1)} of ${total}`;
}

/** What the marks were placed from (`useChangeMap`): they're placed again only when one of these changes. */
export interface MarksPlacedFrom {
  regions: readonly ChangeRegion[];
  bothSides: boolean;
  /** How the lines are laid out: Split or Unified, collapsed, wrapped. */
  layoutKey: string;
  contentHeight: number;
  viewHeight: number;
  /**
   * Where Pierre lays out the last change, none until it can tell (the marks are then placed by line share). It moves
   * as Pierre measures the lines above it: its estimate of a line it hasn't rendered is one row, a wrapped one too.
   */
  lastChangeTop: number | undefined;
}

/**
 * Whether the marks are placed again: none were yet, or the changes, the layout, the sizes or Pierre's place for the
 * last change changed. Scrolling changes none of them, so it places nothing again.
 */
export function placesAgain(previous: MarksPlacedFrom | null, next: MarksPlacedFrom): boolean {
  return (
    previous === null ||
    previous.regions !== next.regions ||
    previous.bothSides !== next.bothSides ||
    previous.layoutKey !== next.layoutKey ||
    previous.contentHeight !== next.contentHeight ||
    previous.viewHeight !== next.viewHeight ||
    previous.lastChangeTop !== next.lastChangeTop
  );
}
