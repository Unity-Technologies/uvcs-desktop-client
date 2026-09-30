import type { ChangedLine } from './changeBlocks';

/** Removed lines come back, added lines go, or both (a changed block goes back to how it was). */
type DiscardKind = 'restore' | 'remove' | 'revert';

export interface DiscardAction {
  kind: DiscardKind;
  /** For a button: "Restore 2 lines". */
  label: string;
  /** Once done, for a toast: "Restored 2 lines". */
  done: string;
}

export function describeDiscard(lines: ChangedLine[]): DiscardAction {
  const removed = lines.filter((line) => line.side === 'deletions').length;
  const added = lines.length - removed;
  if (added === 0) {
    return { kind: 'restore', label: `Restore ${count(removed)}`, done: `Restored ${count(removed)}` };
  }
  if (removed === 0) {
    return { kind: 'remove', label: `Remove ${count(added)}`, done: `Removed ${count(added)}` };
  }
  return { kind: 'revert', label: `Revert ${count(lines.length)}`, done: `Reverted ${count(lines.length)}` };
}

/** The action of a whole change: "Revert change" when it replaces lines, otherwise what it does ("Remove 2 lines"). */
export function wholeChangeLabel(lines: ChangedLine[]): string {
  const action = describeDiscard(lines);
  return action.kind === 'revert' ? 'Revert change' : action.label;
}

/** The action of one changed line: an added line goes, a removed one comes back. */
export function lineActionLabel({ side }: ChangedLine): string {
  return side === 'additions' ? 'Remove line' : 'Restore line';
}

function count(lines: number): string {
  return lines === 1 ? '1 line' : `${lines} lines`;
}
