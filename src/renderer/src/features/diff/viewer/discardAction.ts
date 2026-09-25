import type { ChangedLine } from './changeBlocks';

/** Removed lines come back, added lines go, or both (a changed block goes back to how it was). */
export type DiscardKind = 'restore' | 'remove' | 'revert';

export interface DiscardAction {
  kind: DiscardKind;
  /** For a button: "Restore 2 lines". */
  label: string;
  /** Once done, for a toast: "Restored 2 lines". */
  done: string;
  /** What happens to the file, for a tooltip. */
  description: string;
}

export function describeDiscard(lines: ChangedLine[]): DiscardAction {
  const removed = lines.filter((line) => line.side === 'deletions').length;
  const added = lines.length - removed;
  if (added === 0) {
    return { kind: 'restore', label: `Restore ${count(removed)}`, done: `Restored ${count(removed)}`, description: `Put back ${removed === 1 ? 'the removed line' : `the ${removed} removed lines`}` };
  }
  if (removed === 0) {
    return { kind: 'remove', label: `Remove ${count(added)}`, done: `Removed ${count(added)}`, description: `Delete ${added === 1 ? 'the added line' : `the ${added} added lines`}` };
  }
  return {
    kind: 'revert',
    label: `Revert ${count(lines.length)}`,
    done: `Reverted ${count(lines.length)}`,
    description: `Replace ${added === 1 ? 'this line' : `these ${added} lines`} with the original ${removed === 1 ? 'one' : count(removed)}`,
  };
}

function count(lines: number): string {
  return lines === 1 ? '1 line' : `${lines} lines`;
}
