import { formatCount } from '../../../lib/text';
import type { ChangedLine, ChangeRegion, DiffSide } from './changeBlocks';

/**
 * The change map: a narrow strip beside a text diff's vertical scrollbar marking where its changes are (`ChangeMap`),
 * so the shape of the whole diff reads at a glance and a click on a mark goes to its change. The strip stands for the
 * whole scrolling content, as the scrollbar's track does: a change at a share of the content's height is marked at
 * that share of the strip's.
 */

/** What a change does: adds lines only, removes lines only, or both (a line changed). */
export type ChangeKind = 'added' | 'deleted' | 'changed';

/** A mark of the strip, in its pixels: one change, or several too close to tell apart (`first` to `last`). */
export interface ChangeMark {
  top: number;
  height: number;
  kind: ChangeKind;
  /** The first change it stands for, by index; where a click on it goes. */
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
  /** The strip's height, which stands for the whole content. */
  stripHeight: number;
}

/** A mark is never thinner than this, so a change of one line among thousands still shows and can be clicked. */
export const MIN_MARK_HEIGHT = 3;

/** A click this close to a mark goes to its change: a mark of a few pixels is hard to hit exactly. */
const HIT_SLOP = 2;

/** Whether the map shows: a diff of two versions that has changes and doesn't fit without scrolling. */
export function showsChangeMap({ changes, bothSides, contentHeight, viewHeight }: { changes: number; bothSides: boolean; contentHeight: number; viewHeight: number }): boolean {
  // A version shown alone (an added or deleted file) is one change, the whole text: nothing to map.
  return changes > 0 && bothSides && viewHeight > 0 && contentHeight > viewHeight + 1;
}

export function changeKindOf(region: ChangeRegion): ChangeKind {
  const removes = region.lines.some((line) => line.side === 'deletions');
  const adds = region.lines.some((line) => line.side === 'additions');
  return removes && adds ? 'changed' : removes ? 'deleted' : 'added';
}

/**
 * The marks of the changes, top to bottom. Changes whose marks would overlap share one, so however many changes a file
 * has, the marks are at most one for every `MIN_MARK_HEIGHT` pixels of the strip: what's drawn is bounded by the strip,
 * not the file. Each change asks where at most four lines are (the first and last of each side).
 */
export function changeMarks(regions: readonly ChangeRegion[], layout: ChangeMapLayout): ChangeMark[] {
  const { contentHeight, stripHeight } = layout;
  if (contentHeight <= 0 || stripHeight <= 0) return [];
  const scale = stripHeight / contentHeight;
  const marks: ChangeMark[] = [];
  for (const region of regions) {
    const span = regionSpan(region, layout);
    const height = Math.min(stripHeight, Math.max(MIN_MARK_HEIGHT, Math.ceil(span.bottom * scale) - Math.floor(span.top * scale)));
    const top = Math.min(Math.max(0, Math.floor(span.top * scale)), stripHeight - height);
    const kind = changeKindOf(region);
    const previous = marks.at(-1);
    if (previous && top < previous.top + previous.height) {
      previous.height = Math.max(previous.top + previous.height, top + height) - previous.top;
      previous.kind = previous.kind === kind ? kind : 'changed';
      previous.last = region.index;
    } else {
      marks.push({ top, height, kind, first: region.index, last: region.index });
    }
  }
  return marks;
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

/** What a click on the strip at `y` does: go to the change of the mark there, or scroll the view to center that point. */
export type ChangeMapClick = { to: 'change'; index: number } | { to: 'point'; scrollTop: number };

export function changeMapClick(marks: readonly ChangeMark[], y: number, { contentHeight, stripHeight, viewHeight }: { contentHeight: number; stripHeight: number; viewHeight: number }): ChangeMapClick {
  const hit = nearestMark(marks, y);
  if (hit) return { to: 'change', index: hit.first };
  const point = (y / stripHeight) * contentHeight;
  return { to: 'point', scrollTop: Math.round(Math.min(Math.max(0, point - viewHeight / 2), Math.max(0, contentHeight - viewHeight))) };
}

function nearestMark(marks: readonly ChangeMark[], y: number): ChangeMark | undefined {
  let nearest: ChangeMark | undefined;
  let nearestDistance = Infinity;
  for (const mark of marks) {
    const distance = y < mark.top ? mark.top - y : y >= mark.top + mark.height ? y - (mark.top + mark.height) + 1 : 0;
    if (distance <= HIT_SLOP && distance < nearestDistance) {
      nearest = mark;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** A mark's tooltip: "Change 3 of 12", or "Changes 3–5 of 12" for changes too close to tell apart. */
export function changeMarkLabel(mark: ChangeMark, count: number): string {
  const total = formatCount(count);
  return mark.first === mark.last ? `Change ${formatCount(mark.first + 1)} of ${total}` : `Changes ${formatCount(mark.first + 1)}–${formatCount(mark.last + 1)} of ${total}`;
}

/** Whether a mark stands for the change moved to last (`StepNavigation.current`). */
export function holdsChange(mark: ChangeMark, current: number | null): boolean {
  return current !== null && current >= mark.first && current <= mark.last;
}

export function sameMarks(a: readonly ChangeMark[], b: readonly ChangeMark[]): boolean {
  return a.length === b.length && a.every((mark, index) => {
    const other = b[index]!;
    return mark.top === other.top && mark.height === other.height && mark.kind === other.kind && mark.first === other.first && mark.last === other.last;
  });
}
