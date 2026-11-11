import type { LineBand } from '../../diff/viewer/diffAnnotations';
import type { LineThread } from './fileThreads';
import type { ThreadFocus } from './reviewComments';
import type { LineThreads } from './threadRows';

/**
 * The thread selected by a click or the focus on its card in the code, or by opening its line's marker (`selectThread`):
 * on screen already, so nothing scrolls to it (`inPlace`). The same thread stays as it was, its `seq` too: a second
 * click, or the focus moving within its card, neither lights it again nor moves the Comments panel.
 */
export function selectedInPlace(current: ThreadFocus | null, threadId: number, nextSeq: number): ThreadFocus {
  if (current?.threadId === threadId) return current;
  return { threadId, seq: nextSeq, inPlace: true };
}

/** Whether the file's diff scrolls to the focused thread: when it's gone to, not when it's picked where it shows. */
export function scrollsToFocus(focus: ThreadFocus | null): boolean {
  return focus !== null && focus.inPlace !== true;
}

/** How a thread's card in the code shows the focus. */
export interface CardFocus {
  /** Gone to, the how-many-th time (`ReviewThreadCard`'s `highlight`): unfolded, lit for a moment, scrolled to. */
  highlight?: number;
  /** Selected where it shows: only its ring, the card left folded or unfolded as the user has it. */
  selected: boolean;
}

/**
 * Gone to, a card is unfolded and lit, as what was asked for; selected in place it only takes the ring, since unfolding
 * it then would undo the click that folds it (the chevron's click selects it too).
 */
export function cardFocusOf(focus: ThreadFocus | null, threadId: number): CardFocus {
  if (focus?.threadId !== threadId) return { selected: false };
  return focus.inPlace ? { selected: true } : { highlight: focus.seq, selected: true };
}

/** Every line with threads, outlined in the diff (`LineBands`); the one holding the focused thread, selected. */
export function lineBandsOf(lines: readonly LineThreads[], focus: ThreadFocus | null): LineBand[] {
  return lines.map((line) => ({
    key: line.key,
    side: line.side,
    lineNumber: line.line,
    selected: focus !== null && line.threads.some(({ thread }) => thread.root.id === focus.threadId),
  }));
}

/** The thread a line's marker selects when it opens it: its first, the oldest, which the row shows first. */
export function threadOpenedFrom(line: Pick<LineThreads, 'threads'>): LineThread {
  return line.threads[0].thread;
}
