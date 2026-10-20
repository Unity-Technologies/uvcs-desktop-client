import type { FileConflictResolution } from '@shared/domain/merge';
import { countConflictRegions, hasConflictMarkers, keepConflictRegionBase, resolveConflictRegion, type ConflictDocument, type ConflictRegionChoice } from './threeWayMerge';

/** What the user has decided so far for a conflicting file. */
export type FileConflictDecision =
  /**
   * Working on the merged text; it is resolved once no conflict markers are left. `edited`: typed by hand, rather
   * than a side picked for each conflict; `tool`: the merge tool that saved it. `conflictBases`: the base of each
   * conflict left in `text`, in order, while they are the automatic merge's (`decideConflict` drops the one decided);
   * none once the text was edited by hand or in a tool, whose conflicts may no longer be the merge's.
   */
  | { kind: 'text'; text: string; edited?: boolean; tool?: string; conflictBases?: readonly string[] }
  /** Take one version of the whole file: a side's, or the base's (the common ancestor's), for a file that has one. */
  | { kind: 'wholeFile'; side: KeptVersion };

/** A decision on the merged text, conflict by conflict or by hand. */
export type TextDecision = Extract<FileConflictDecision, { kind: 'text' }>;

/** The versions a file can keep whole. */
export type KeptVersion = 'source' | 'destination' | 'base';

/** Text files start from the automatic merge; binary files need an explicit choice. */
export function initialDecision(document: ConflictDocument | undefined): TextDecision | undefined {
  return document ? { kind: 'text', text: document.text, conflictBases: document.conflictBases } : undefined;
}

/** How one conflict is settled: a side, both, or its base. */
export type ConflictBlockChoice = ConflictRegionChoice | 'base';

/**
 * The decision once conflict number `conflictIndex` of the text is settled, the bases of the others carried along. Its
 * base only when known (`conflictBaseAt`).
 */
export function decideConflict(decision: TextDecision, conflictIndex: number, choice: ConflictBlockChoice): TextDecision {
  const base = conflictBaseAt(decision, conflictIndex);
  if (choice === 'base' && base === undefined) throw new Error(`Conflict ${conflictIndex + 1} has no base known to keep.`);
  const text = choice === 'base' ? keepConflictRegionBase(decision.text, conflictIndex, base!) : resolveConflictRegion(decision.text, conflictIndex, choice);
  const conflictBases = decision.conflictBases?.filter((_, index) => index !== conflictIndex);
  return { kind: 'text', text, ...(decision.edited && { edited: true }), ...(conflictBases && { conflictBases }) };
}

/** The base of conflict number `conflictIndex` left in the decision's text, while known. */
export function conflictBaseAt(decision: FileConflictDecision | undefined, conflictIndex: number): string | undefined {
  return decision?.kind === 'text' ? decision.conflictBases?.[conflictIndex] : undefined;
}

/**
 * The resolution to send to the merge, or null while the file still needs the user. Keeping the source or the base
 * carries its text (`texts`, as read) when writing it gives back its bytes, so the merge needn't read it from the
 * server again.
 */
export function resolutionOf(decision: FileConflictDecision | undefined, texts: { source?: string; base?: string } = {}): FileConflictResolution | null {
  if (!decision) return null;
  if (decision.kind === 'wholeFile') {
    if (decision.side === 'destination') return { choice: 'destination' };
    const text = texts[decision.side];
    return text !== undefined && writesBackAsRead(text) ? { choice: decision.side, text } : { choice: decision.side };
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
