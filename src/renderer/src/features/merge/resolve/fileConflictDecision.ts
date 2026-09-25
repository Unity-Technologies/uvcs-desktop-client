import type { FileConflictResolution } from '@shared/domain/merge';
import { countConflictRegions, hasConflictMarkers, type ConflictDocument } from './threeWayMerge';

/** What the user has decided so far for a conflicting file. */
export type FileConflictDecision =
  /**
   * Working on the merged text; it is resolved once no conflict markers are left. `edited`: typed by hand, rather
   * than a side picked for each conflict; `tool`: the merge tool that saved it.
   */
  | { kind: 'text'; text: string; edited?: boolean; tool?: string }
  /** Take one version of the whole file; `tool`: picked in a merge tool. */
  | { kind: 'wholeFile'; side: 'source' | 'destination'; tool?: string };

/** Text files start from the automatic merge; binary files need an explicit choice. */
export function initialDecision(document: ConflictDocument | undefined): FileConflictDecision | undefined {
  return document ? { kind: 'text', text: document.text } : undefined;
}

/** The resolution to send to the merge, or null while the file still needs the user. */
export function resolutionOf(decision: FileConflictDecision | undefined): FileConflictResolution | null {
  if (!decision) return null;
  if (decision.kind === 'wholeFile') return { choice: decision.side };
  return hasConflictMarkers(decision.text) ? null : { choice: 'text', text: decision.text };
}

/** Remaining conflict regions in a decision's text. */
export function remainingConflicts(decision: FileConflictDecision | undefined): number {
  return decision?.kind === 'text' ? countConflictRegions(decision.text) : 0;
}
