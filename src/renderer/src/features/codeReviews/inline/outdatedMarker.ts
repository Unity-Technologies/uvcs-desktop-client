import { listNames, pluralize } from '../../../lib/text';
import { outdatedKey } from './fileComments';
import type { EarlierThread } from './fileThreads';
import { markerTip } from './markerTip';
import { markerCommentCount, markerIsOpen, markerNames, type MarkedThreads } from './threadRows';

/** The marker a file's outdated threads leave on the code's first row while comments are hidden. */
export interface OutdatedMarker {
  /** The outdated threads still folded away. */
  threads: EarlierThread[];
  label: string;
  tip: string;
  emphasized: boolean;
  /** What's opened once it's clicked: every outdated thread it marks, after what was opened already. */
  opens: string[];
}

/**
 * While comments are hidden (`inCode` false), a file's outdated threads keep a marker on the code's first row, as a
 * line's keep one on the line: hiding them never leaves a file looking as if no one commented on it. It marks those not
 * opened yet (one gone to shows already), and counts and names as a line's marker beside it does: every comment,
 * replies too. None while comments show in the code (the outdated ones show above it), or when every one shows.
 */
export function outdatedMarkerOf(outdated: readonly EarlierThread[], opened: readonly string[], inCode: boolean): OutdatedMarker | null {
  if (inCode) return null;
  const folded = outdated.filter((entry) => !opened.includes(outdatedKey(entry.thread.root.id)));
  if (folded.length === 0) return null;
  const marked = { threads: folded };
  return {
    threads: folded,
    label: `${pluralize(markerCommentCount(marked), 'outdated comment')}, by ${listNames(markerNames(marked))}`,
    tip: outdatedTip(marked),
    emphasized: markerIsOpen(marked),
    opens: [...opened, ...folded.map((entry) => outdatedKey(entry.thread.root.id))],
  };
}

/** What outdated threads say on hover, their marker's and their tick's in the change map: what outdated means, then each. */
export function outdatedTip(outdated: MarkedThreads): string {
  return `Outdated: on lines changed since\n\n${markerTip(outdated)}`;
}
