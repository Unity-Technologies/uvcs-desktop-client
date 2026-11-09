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

/** The choice the panel shows picked: Keep both while its name is being given, else the decision applied. */
export function pickedChoice(naming: boolean, applied: DirectoryConflictResolution | undefined): DirectoryConflictResolution['choice'] | undefined {
  return naming ? 'rename' : applied?.choice;
}

/** Whether `conflict` is decided as `resolution` already: deciding it so again changes nothing. */
export function isDecidedAs(decisions: readonly DirectoryDecision[], conflict: DirectoryConflict, resolution: DirectoryConflictResolution): boolean {
  const identity = directoryConflictIdentity(conflict);
  const decided = decisions.find((decision) => directoryConflictIdentity(decision.conflict) === identity)?.resolution;
  if (decided?.choice === 'rename' && resolution.choice === 'rename') return decided.newName === resolution.newName;
  return decided?.choice === resolution.choice;
}

/**
 * The conflicts after `conflict` in the list (`ordered`) of the same kind, not decided yet: those "Do the same for the
 * next conflicts of this kind" decides with it. The same kind offers the same choices, so each takes the decision.
 */
export function nextOfSameKind(
  ordered: readonly DirectoryConflict[],
  conflict: DirectoryConflict,
  resolutions: ReadonlyMap<string, DirectoryConflictResolution>,
): DirectoryConflict[] {
  const identity = directoryConflictIdentity(conflict);
  const index = ordered.findIndex((other) => directoryConflictIdentity(other) === identity);
  if (index < 0) return [];
  return ordered.slice(index + 1).filter((other) => other.type === conflict.type && !resolutions.has(directoryConflictIdentity(other)));
}

/**
 * The page's decisions with `conflict` decided as `resolution`, then each of `next` decided the same way, in order.
 * Keep both decides only `conflict`: the name it gives belongs to one item.
 */
export function withDecisionAndNext(
  decisions: readonly DirectoryDecision[],
  conflict: DirectoryConflict,
  resolution: DirectoryConflictResolution,
  next: readonly DirectoryConflict[],
): DirectoryDecision[] {
  const decided = withDecision(decisions, conflict, resolution);
  if (resolution.choice === 'rename') return decided;
  return next.reduce((all, other) => withDecision(all, other, resolution), decided);
}

/** The label of the box deciding the next conflicts of the same kind too: "Do the same for the next 3 conflicts of this kind". */
export function applyToNextLabel(count: number): string {
  return count === 1 ? 'Do the same for the next conflict of this kind' : `Do the same for the next ${count} conflicts of this kind`;
}

/**
 * Whether deciding `conflict` as `resolution`, with the `next` conflicts the same way, changes the page's decisions:
 * not when it is decided so already and no next one goes with it (Keep both takes none).
 */
export function changesDecisions(
  decisions: readonly DirectoryDecision[],
  conflict: DirectoryConflict,
  resolution: DirectoryConflictResolution,
  next: readonly DirectoryConflict[],
): boolean {
  return !isDecidedAs(decisions, conflict, resolution) || (resolution.choice !== 'rename' && next.length > 0);
}

/** The box deciding the next conflicts of the same kind too, as the panel shows it. */
export interface ApplyToNextBox {
  label: string;
  checked: boolean;
  disabled: boolean;
}

/**
 * The box the panel shows for the `nextCount` conflicts of the same kind waiting after this one, with the choice
 * `picked` and the box as the user left it (`checked`): none when none waits; off and disabled for Keep both, whose
 * name belongs to one item (`withDecisionAndNext`).
 */
export function applyToNextBox(nextCount: number, picked: DirectoryConflictResolution['choice'] | undefined, checked: boolean): ApplyToNextBox | undefined {
  if (nextCount === 0) return undefined;
  const keepingBoth = picked === 'rename';
  return { label: applyToNextLabel(nextCount), checked: checked && !keepingBoth, disabled: keepingBoth };
}
