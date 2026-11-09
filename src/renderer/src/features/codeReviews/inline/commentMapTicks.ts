import type { MapTick } from '../../diff/viewer/mapTicks';
import { OUTDATED_ROW, type FileComments } from './fileComments';
import type { ThreadSide } from './fileThreads';
import { markerTip } from './markerTip';
import { outdatedTip } from './outdatedMarker';
import { markerIsOpen, type MarkedThreads } from './threadRows';

/**
 * Where a file's comments are, marked in its diff's change map (`DiffAnnotations.mapTicks`): a tick for each line with
 * threads, and one at the track's top for the outdated ones (`lineNumber: 0`, on the side the file has), whether
 * comments show in the code or are folded into markers. A tick stands out, as its line's marker does, while anything
 * there is still open (`markerIsOpen`). Threads still being placed have no line yet, so no tick.
 */
export function commentMapTicks(comments: Pick<FileComments, 'lines' | 'outdated'>, topSide: ThreadSide): MapTick[] {
  const ticks = comments.lines.map((line): MapTick => ({ key: line.key, side: line.side, lineNumber: line.line, emphasized: markerIsOpen(line) }));
  if (comments.outdated.length > 0) ticks.push({ key: OUTDATED_ROW, side: topSide, lineNumber: 0, emphasized: markerIsOpen({ threads: comments.outdated }) });
  return ticks;
}

/**
 * What a tick says on hover, of the spots fused into it (`MapTickMark.keys`): the lines' threads previewed together as
 * a marker does a line's (`markerTip`), in the tick's order, three at most and then how many more; then, when the
 * outdated ones fused in too (their tick at the top, beside a comment on the first lines), theirs as their marker says
 * them (`outdatedTip`), so they never read as if on that line. Nothing for a spot no longer there.
 */
export function commentMapTip(comments: Pick<FileComments, 'lines' | 'outdated'>, keys: readonly string[]): string {
  const lineThreads = keys.flatMap((key): MarkedThreads['threads'] => comments.lines.find((line) => line.key === key)?.threads ?? []);
  const parts = [lineThreads.length > 0 ? markerTip({ threads: lineThreads }) : null, keys.includes(OUTDATED_ROW) && comments.outdated.length > 0 ? outdatedTip({ threads: comments.outdated }) : null];
  return parts.filter((part) => part !== null).join('\n\n');
}
