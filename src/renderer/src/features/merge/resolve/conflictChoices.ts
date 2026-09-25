import type { ConflictStatus } from '../mergeStatus';
import type { FileConflictDecision } from './fileConflictDecision';
import { resolveEveryConflictRegion, type ConflictDocument } from './threeWayMerge';

/**
 * The ways to settle a file with conflicts at once: keep one version, keep both sides of every conflict, or write the
 * result by hand. Conflicts can also be decided one by one.
 */
export type ConflictChoice = 'destination' | 'source' | 'both' | 'byHand';

/** The decision a choice stands for; by hand has none until the user writes it. */
export function decisionFor(choice: Exclude<ConflictChoice, 'byHand'>, document: ConflictDocument): FileConflictDecision {
  return choice === 'both' ? { kind: 'text', text: bothSides(document) } : { kind: 'wholeFile', side: choice };
}

/** The choice the file's decision stands for, to show it picked; none while undecided or picked conflict by conflict. */
export function chosenConflictChoice(
  status: ConflictStatus,
  decision: FileConflictDecision | undefined,
  document: ConflictDocument | undefined,
): ConflictChoice | undefined {
  switch (status) {
    case 'keepingDestination':
      return 'destination';
    case 'keepingSource':
      return 'source';
    case 'edited':
      return 'byHand';
    case 'combined':
      return decision?.kind === 'text' && document && decision.text === bothSides(document) ? 'both' : undefined;
    default:
      return undefined;
  }
}

/** Whether the file needs (or needed) the user: the automatic merge left conflicts in it. */
export function hasConflicts(document: ConflictDocument | undefined): boolean {
  return (document?.conflictCount ?? 0) > 0;
}

function bothSides(document: ConflictDocument): string {
  return resolveEveryConflictRegion(document.text, 'both');
}
