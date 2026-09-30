import type { FileConflictState } from './useFileConflicts';

/**
 * What to look at: the conflicts left to decide or, once none is left, what the merge changes in the destination; or
 * one contributor (each side against the base, or the base itself).
 */
export type PanelView = 'conflicts' | 'changes' | 'destination' | 'source' | 'base';

/** Conflicts and changes share the first place: a file shows its conflicts while any is left, then what it changes. */
export function effectiveView(chosen: PanelView | undefined, state: FileConflictState): PanelView {
  const first = state.remainingConflicts > 0 ? 'conflicts' : 'changes';
  if (chosen === undefined || chosen === 'conflicts' || chosen === 'changes') return first;
  if (chosen === 'base' && !hasBase(state)) return first;
  return chosen;
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
