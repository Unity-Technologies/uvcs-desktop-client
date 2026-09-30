import type { FileConflictResolution } from '@shared/domain/merge';
import { countConflictRegions, hasConflictMarkers, type ConflictDocument } from './threeWayMerge';

/** What the user has decided so far for a conflicting file. */
export type FileConflictDecision =
  /**
   * Working on the merged text; it is resolved once no conflict markers are left. `edited`: typed by hand, rather
   * than a side picked for each conflict; `tool`: the merge tool that saved it.
   */
  | { kind: 'text'; text: string; edited?: boolean; tool?: string }
  /** Take one version of the whole file. */
  | { kind: 'wholeFile'; side: 'source' | 'destination' };

/** Text files start from the automatic merge; binary files need an explicit choice. */
export function initialDecision(document: ConflictDocument | undefined): FileConflictDecision | undefined {
  return document ? { kind: 'text', text: document.text } : undefined;
}

/**
 * The resolution to send to the merge, or null while the file still needs the user. Keeping the source carries its
 * text (`sourceText`, as read) when writing it gives back its bytes, so the merge needn't read it from the server again.
 */
export function resolutionOf(decision: FileConflictDecision | undefined, sourceText?: string): FileConflictResolution | null {
  if (!decision) return null;
  if (decision.kind === 'wholeFile') {
    if (decision.side === 'source' && sourceText !== undefined && writesBackAsRead(sourceText)) return { choice: 'source', text: sourceText };
    return { choice: decision.side };
  }
  return hasConflictMarkers(decision.text) ? null : { choice: 'text', text: decision.text };
}

/**
 * Whether text read from a file writes back as the same bytes: it was valid UTF-8. Anything else (Latin-1, a stray
 * byte) was read with U+FFFD in its place.
 */
function writesBackAsRead(text: string): boolean {
  return !text.includes('\uFFFD');
}

/** Remaining conflict regions in a decision's text. */
export function remainingConflicts(decision: FileConflictDecision | undefined): number {
  return decision?.kind === 'text' ? countConflictRegions(decision.text) : 0;
}
