import { directoryConflictIdentity } from '@shared/domain/directoryConflictIdentity';
import { isValidRenameName, type DirectoryConflict, type DirectoryConflictResolution, type DirectoryDecision } from '@shared/domain/merge';
import { fileNameOf, pluralize } from '../../../lib/text';

/**
 * The page's decisions with `conflict` decided as `resolution`: in the place it was decided before, as changing it
 * applies again the decisions after it, else after the others.
 */
export function withDecision(decisions: readonly DirectoryDecision[], conflict: DirectoryConflict, resolution: DirectoryConflictResolution): DirectoryDecision[] {
  const identity = directoryConflictIdentity(conflict);
  const index = decisions.findIndex((decision) => directoryConflictIdentity(decision.conflict) === identity);
  const decision = { conflict: index < 0 ? conflict : decisions[index]!.conflict, resolution };
  return index < 0 ? [...decisions, decision] : decisions.map((other, at) => (at === index ? decision : other));
}

/** The decisions asked that the merge didn't take: an earlier one took their conflict out of it. */
export function droppedDecisions(asked: readonly DirectoryDecision[], applied: readonly DirectoryDecision[]): DirectoryDecision[] {
  const taken = new Set(applied.map((decision) => directoryConflictIdentity(decision.conflict)));
  return asked.filter((decision) => !taken.has(directoryConflictIdentity(decision.conflict)));
}

/** Each decided conflict's resolution, by its identity: where the page's directory conflicts stand. */
export function resolutionsByConflict(decisions: readonly DirectoryDecision[]): ReadonlyMap<string, DirectoryConflictResolution> {
  return new Map(decisions.map((decision) => [directoryConflictIdentity(decision.conflict), decision.resolution]));
}

/** The toast telling that decisions no longer apply: "Your decision on shared no longer applies". */
export function droppedDecisionsToast(dropped: readonly DirectoryDecision[]): { title: string; detail: string } {
  const title =
    dropped.length === 1 ? `Your decision on ${fileNameOf(dropped[0]!.conflict.destination.path)} no longer applies` : `${pluralize(dropped.length, 'decision')} no longer apply`;
  return { title, detail: 'Another decision changed what the merge does there.' };
}

/**
 * Whether "Keep both" can be applied with `newName`: a name the merge takes (`isValidRenameName`) that isn't the one
 * applied already.
 */
export function canKeepBothAs(newName: string, applied: DirectoryConflictResolution | undefined): boolean {
  return isValidRenameName(newName) && !(applied?.choice === 'rename' && applied.newName === newName);
}

/** Whether `conflict` is decided as `resolution` already: deciding it so again changes nothing. */
export function isDecidedAs(decisions: readonly DirectoryDecision[], conflict: DirectoryConflict, resolution: DirectoryConflictResolution): boolean {
  const identity = directoryConflictIdentity(conflict);
  const decided = decisions.find((decision) => directoryConflictIdentity(decision.conflict) === identity)?.resolution;
  if (decided?.choice === 'rename' && resolution.choice === 'rename') return decided.newName === resolution.newName;
  return decided?.choice === resolution.choice;
}
