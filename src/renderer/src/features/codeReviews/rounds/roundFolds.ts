import type { ConversationBlock } from './reviewRounds';

/**
 * Whether a round shows what it held: as the user last chose with a click on its line (`chosen`), else a settled round
 * folded and one with something open unfolded, as is the round holding the thread the conversation went to, so going to
 * a thread never lands on a folded line. A choice, not a toggle: a round folded while it held the thread stays folded
 * once the page goes elsewhere.
 */
export function roundIsOpen(round: { number: number; folds: boolean }, chosen: ReadonlyMap<number, boolean>, holdingPick: number | undefined): boolean {
  return chosen.get(round.number) ?? (round.number === holdingPick || !round.folds);
}

/**
 * What a round's line shows under it: while folded, what its reviewer said with the status that closed it, so the
 * verdict and its words read at a glance; unfolded, nothing, as the status's own event shows it at the round's end.
 */
export function roundLineComment(round: { comment: string }, open: boolean): string | undefined {
  return !open && round.comment.trim() ? round.comment : undefined;
}

/** The user's choices after a click on `number`'s line, shown `open` until then. */
export function roundChosen(chosen: ReadonlyMap<number, boolean>, number: number, open: boolean): Map<number, boolean> {
  return new Map(chosen).set(number, !open);
}

/**
 * The user's choices once the conversation goes to a thread in `holdingPick`: its choice forgotten, so it unfolds again
 * even when folded by hand; the same choices when the thread is after every round.
 */
export function roundChoiceForgotten(chosen: ReadonlyMap<number, boolean>, holdingPick: number | undefined): ReadonlyMap<number, boolean> {
  if (holdingPick === undefined || !chosen.has(holdingPick)) return chosen;
  const next = new Map(chosen);
  next.delete(holdingPick);
  return next;
}

/**
 * Whether the conversation opens scrolled to its "New since your last review" line: when it has one, and the page wasn't opened
 * at a thread (Show in conversation), which it goes to instead.
 */
export function opensAtSince(blocks: readonly ConversationBlock[], focusThread: number | undefined): boolean {
  return focusThread === undefined && blocks.some((block) => block.kind === 'since');
}
