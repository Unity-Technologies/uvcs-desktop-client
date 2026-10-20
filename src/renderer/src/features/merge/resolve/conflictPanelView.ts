import { hasLineTooLongToEdit } from '../../diff/viewer/longLines';
import { conflictBaseAt } from './fileConflictDecision';
import type { FileConflictState } from './useFileConflicts';

/**
 * What to look at: the conflicts left to decide or, once none is left, what the merge changes in the destination; or
 * one contributor (each side against the base, or the base itself). A binary file opens on its versions to choose
 * from (`choice`), and where they render (a model, an image) shows each side against the base too.
 */
export type PanelView = 'conflicts' | 'changes' | 'choice' | 'destination' | 'source' | 'base';

/** Conflicts and changes share the first place: a file shows its conflicts while any is left, then what it changes. */
export function effectiveView(chosen: PanelView | undefined, state: FileConflictState): PanelView {
  if (state.isBinary) return rendersVersions(state) && (chosen === 'destination' || chosen === 'source' || (chosen === 'base' && hasBase(state))) ? chosen : 'choice';
  const first = state.remainingConflicts > 0 ? 'conflicts' : 'changes';
  if (chosen === undefined || chosen === 'conflicts' || chosen === 'changes') return first;
  if (chosen === 'base' && !hasBase(state)) return first;
  return chosen;
}

/** A binary whose versions show as what they are (3D models, images): each side can be compared with the base. */
export function rendersVersions(state: FileConflictState): boolean {
  const { contents } = state;
  if (!state.isBinary || !contents) return false;
  const versions = [contents.base, contents.source, contents.destination].filter((content) => content.size > 0);
  return versions.length > 0 && (versions.every((content) => content.model) || versions.every((content) => content.image));
}

/**
 * Whether keeping the base is offered: only for a file that has one, and not when the merge undoes a changeset, whose
 * base is the change being undone (`ConflictedFile.baseIsUndoneChange`): keeping it would put that change back.
 */
export function offersKeepBase(state: FileConflictState): boolean {
  return hasBase(state) && !state.file.baseIsUndoneChange;
}

/** Whether conflict number `conflictIndex` of the file's text offers keeping its base: the file offers it, and that conflict's is known. */
export function offersConflictBase(state: FileConflictState, conflictIndex: number): boolean {
  return offersKeepBase(state) && conflictBaseAt(state.decision, conflictIndex) !== undefined;
}

/** A file added on both sides has no common ancestor to show. */
export function hasBase(state: FileConflictState): boolean {
  return state.file.base.kind !== 'empty';
}

/** The text the merge will write, once no conflict is left in it; null for binaries and while conflicts remain. */
export function mergedText(state: FileConflictState): string | null {
  const { decision, contents } = state;
  if (state.status !== 'ready' || state.isBinary || !decision || !contents) return null;
  if (decision.kind === 'wholeFile') return contents[decision.side].text ?? '';
  return state.remainingConflicts > 0 ? null : decision.text;
}

/** Resolving by hand starts from where the file stands: the merged text with its conflict markers, or the result chosen. */
export function textToEdit(state: FileConflictState): string {
  const { decision, contents, document } = state;
  if (decision?.kind === 'wholeFile') return contents?.[decision.side].text ?? '';
  return decision?.text ?? document?.text ?? '';
}

/**
 * How many conflicts the panel's arrows step through in `view` (`ConflictNavigator`): those left in its text, or one
 * for a binary still waiting for the version to keep; none in a file that couldn't be read, nor in one just decided
 * while shown (`decidedHere`, `justDecided`), whose arrows go straight on to the next file instead of through the
 * changes the merge makes. Null where the view steps through its own changes (a diff), and in the base or a file still
 * loading.
 */
export function conflictsToStep(view: PanelView, state: FileConflictState, decidedHere: boolean): number | null {
  if (view === 'choice') return state.resolution ? 0 : 1;
  if (state.status === 'error') return 0;
  if (view === 'conflicts' && state.status === 'ready') return state.remainingConflicts;
  if (view === 'changes' && decidedHere) return 0;
  return null;
}

/** What a conflicting file's panel keeps while it shows the file: the view the user picked, and its conflicts. */
export interface PanelMemory {
  chosen: PanelView | undefined;
  /** The file showed conflicts since the panel opened on it. */
  sawConflicts: boolean;
  /** How many conflicts it showed last. */
  remaining: number;
}

export const FRESH_PANEL: PanelMemory = { chosen: undefined, sawConflicts: false, remaining: 0 };

/**
 * The panel's memory once the file is `state`: conflicts coming back (started over) open them again, whatever view
 * was picked.
 */
export function rememberConflicts(memory: PanelMemory, state: FileConflictState): PanelMemory {
  const remaining = state.remainingConflicts;
  const cameBack = memory.remaining === 0 && remaining > 0;
  return { chosen: cameBack ? undefined : memory.chosen, sawConflicts: memory.sawConflicts || remaining > 0, remaining };
}

/**
 * Whether a file was just decided while shown: it had conflicts since the panel opened on it, and has none left. Its
 * conflict arrows stay over its Changes until the user leaves the file, whatever view is picked.
 */
export function justDecided(memory: PanelMemory, state: FileConflictState): boolean {
  return memory.sawConflicts && state.remainingConflicts === 0;
}

/**
 * Why the text can't be edited in the app, for the menu entry's tooltip; null when it can. Not with a line too long to
 * type into (`hasLineTooLongToEdit`): one keystroke in a wrapped line of 2 MB held Pierre's editor for minutes.
 */
export function editInAppUnavailable(state: FileConflictState): string | null {
  return hasLineTooLongToEdit([textToEdit(state)]) ? 'A line of this file is too long to edit here' : null;
}
