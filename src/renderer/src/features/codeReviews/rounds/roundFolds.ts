import type { ConversationBlock } from './reviewRounds';

/**
 * Whether a round shows what it held: a settled round starts folded and one with something open unfolded, each click
 * on its line turning that over (`toggled`); the round holding the thread the conversation went to is always unfolded,
 * so going to a thread never lands on a folded line.
 */
export function roundIsOpen(round: { number: number; folds: boolean }, toggled: ReadonlySet<number>, holdingPick: number | undefined): boolean {
  return round.number === holdingPick || round.folds === toggled.has(round.number);
}

/** The rounds toggled after one more click on `number`'s line. */
export function toggledRound(toggled: ReadonlySet<number>, number: number): Set<number> {
  const next = new Set(toggled);
  if (!next.delete(number)) next.add(number);
  return next;
}

/**
 * Whether the conversation opens scrolled to its "Since last review" line: when it has one, and the page wasn't opened
 * at a thread (Show in conversation), which it goes to instead.
 */
export function opensAtSince(blocks: readonly ConversationBlock[], focusThread: number | undefined): boolean {
  return focusThread === undefined && blocks.some((block) => block.kind === 'since');
}
