import type { ConversationBlock } from './reviewRounds';

/**
 * Whether a round shows what it held: a settled round starts folded and one with something open unfolded, as does the
 * round holding the thread the conversation went to, so going to a thread never lands on a folded line; each click on
 * its line turns that over (`toggled`), that round's too.
 */
export function roundIsOpen(round: { number: number; folds: boolean }, toggled: ReadonlySet<number>, holdingPick: number | undefined): boolean {
  const startsOpen = round.number === holdingPick || !round.folds;
  return startsOpen !== toggled.has(round.number);
}

/**
 * What a round's line shows under it: while folded, what its reviewer said with the status that closed it, so the
 * verdict and its words read at a glance; unfolded, nothing, as the status's own event shows it at the round's end.
 */
export function roundLineComment(round: { comment: string }, open: boolean): string | undefined {
  return !open && round.comment.trim() ? round.comment : undefined;
}

/** The rounds toggled after one more click on `number`'s line. */
export function toggledRound(toggled: ReadonlySet<number>, number: number): Set<number> {
  const next = new Set(toggled);
  if (!next.delete(number)) next.add(number);
  return next;
}

/**
 * The rounds toggled once the conversation goes to a thread in `holdingPick`: its clicks forgotten, so it unfolds again
 * even when folded by hand; the same set when the thread is after every round.
 */
export function untoggledRound(toggled: ReadonlySet<number>, holdingPick: number | undefined): ReadonlySet<number> {
  if (holdingPick === undefined || !toggled.has(holdingPick)) return toggled;
  const next = new Set(toggled);
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
