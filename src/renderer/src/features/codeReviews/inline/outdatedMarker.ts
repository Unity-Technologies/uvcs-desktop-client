import { listNames, pluralize } from '../../../lib/text';
import { displayName } from '../../../lib/userName';
import { outdatedKey } from './fileComments';
import type { EarlierThread } from './fileThreads';
import { markerTip } from './markerTip';
import { markerIsOpen } from './threadRows';

/** The marker a file's outdated threads leave above its code while comments are hidden. */
export interface OutdatedMarker {
  /** The outdated threads still folded away. */
  threads: EarlierThread[];
  /** How many threads, as the strip above the code counts them when comments show. */
  count: number;
  label: string;
  tip: string;
  emphasized: boolean;
  /** What's opened once it's clicked: every outdated thread it marks, after what was opened already. */
  opens: string[];
}

/**
 * While comments are hidden, a file's outdated threads keep a marker above its code, as a line's keep one on the line:
 * hiding them never leaves a file looking as if no one commented on it. It marks those not opened yet (one gone to
 * shows already); none when every one shows, or the file has none.
 */
export function outdatedMarkerOf(outdated: readonly EarlierThread[], opened: readonly string[]): OutdatedMarker | null {
  const folded = outdated.filter((entry) => !opened.includes(outdatedKey(entry.thread.root.id)));
  if (folded.length === 0) return null;
  const marked = { threads: folded };
  const what = pluralize(folded.length, 'outdated comment');
  const people = [...new Set(folded.map((entry) => displayName(entry.thread.root.author)))];
  return {
    threads: folded,
    count: folded.length,
    label: `${what}, by ${listNames(people)}`,
    tip: `${what}, on lines changed since\n\n${markerTip(marked)}`,
    emphasized: markerIsOpen(marked),
    opens: [...opened, ...folded.map((entry) => outdatedKey(entry.thread.root.id))],
  };
}
