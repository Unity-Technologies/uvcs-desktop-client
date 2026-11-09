import type { ChangedLine } from './changeBlocks';
import { shareOfSide, type ChangeMapLayout } from './changeMarks';

/**
 * The change map's ticks: spots a place marks in the diff's scrollbar besides its changes (a review's comments:
 * `commentMapTicks`), each a thin line across the whole track, the opposite shape of a change's block (tall, inset from
 * each side), so one never reads as a change and needs no lane of its own. The viewer knows nothing of what they are.
 */

/** A spot a place marks in the change map: a line of a side, `lineNumber: 0` for what's above the code. */
export interface MapTick extends ChangedLine {
  /** Names the spot among the place's: what its tooltip is asked for (`DiffAnnotations.mapTickTip`). */
  key: string;
  /** Drawn louder: something there still waits for an answer, as its line's marker (`LineMarker.emphasized`). */
  emphasized: boolean;
}

/** How tall a tick is drawn, in the track's pixels. */
export const TICK_HEIGHT = 2;

/** Ticks whose tops are closer than their height and this gap fuse into one: the track bounds what's drawn. */
export const TICK_FUSE_GAP = 3;

/** A tick of the track, in its pixels: one spot, or several too close to tell apart fused into one. */
export interface MapTickMark {
  top: number;
  /** Any spot fused into it is emphasized. */
  emphasized: boolean;
  /** The spots it stands for, top to bottom, for its tooltip. */
  keys: string[];
}

/**
 * The ticks of the spots, top to bottom: each at its line's top where Pierre lays it out (`pierreLineBox`, as changes
 * are placed) or at its share of its side, what's above the code at the track's very top. A tick closer than
 * `TICK_HEIGHT + TICK_FUSE_GAP` to the one above joins it, so the ticks drawn are at most one every few pixels of the
 * track, however many comments a file has.
 */
export function mapTickMarks(ticks: readonly MapTick[], layout: ChangeMapLayout): MapTickMark[] {
  const { contentHeight, trackHeight } = layout;
  if (contentHeight <= 0 || trackHeight <= 0) return [];
  const scale = trackHeight / contentHeight;
  const placed = ticks
    .map((tick) => ({ tick, top: Math.min(Math.max(0, Math.floor(contentTop(tick, layout) * scale)), Math.max(0, trackHeight - TICK_HEIGHT)) }))
    .sort((a, b) => a.top - b.top);
  const marks: MapTickMark[] = [];
  for (const { tick, top } of placed) {
    const previous = marks.at(-1);
    if (previous && top < previous.top + TICK_HEIGHT + TICK_FUSE_GAP) {
      previous.emphasized ||= tick.emphasized;
      previous.keys.push(tick.key);
    } else {
      marks.push({ top, emphasized: tick.emphasized, keys: [tick.key] });
    }
  }
  return marks;
}

const NO_TICKS: readonly MapTick[] = [];

/**
 * The ticks a text diff's change map draws of what its place marks (`DiffAnnotations.mapTicks`): none for a file typed
 * into whole, which shows none of the place's rows, nor where the place marks nothing. The same empty list each time,
 * so the map isn't placed again for it.
 */
export function shownMapTicks(placeTicks: readonly MapTick[] | undefined, wholeFile: boolean): readonly MapTick[] {
  return wholeFile || !placeTicks ? NO_TICKS : placeTicks;
}

/**
 * Where Pierre lays out the lowest tick's line (`placesAgain`'s `lastTickTop`): it moves as Pierre measures the lines
 * above it, so the ticks are placed again. Whatever order the place lists them in (a review's: the older side's lines,
 * the newer side's, the outdated ones last), and never what's above the code, which has no line to measure. None until
 * Pierre can place one.
 */
export function lowestTickTop(ticks: readonly MapTick[], boxOf: (line: ChangedLine) => { top: number } | undefined): number | undefined {
  let lowest: number | undefined;
  for (const tick of ticks) {
    if (tick.lineNumber < 1) continue;
    const top = boxOf(tick)?.top;
    if (top !== undefined && (lowest === undefined || top > lowest)) lowest = top;
  }
  return lowest;
}

/** Where a spot starts in the scrolling content: its line's top, or the content's top for what's above the code. */
function contentTop(tick: MapTick, layout: ChangeMapLayout): number {
  if (tick.lineNumber < 1) return 0;
  return (layout.boxOf(tick) ?? shareOfSide(tick, layout)).top;
}
