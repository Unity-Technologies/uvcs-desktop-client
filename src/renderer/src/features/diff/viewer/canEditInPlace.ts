import type { ContentSource } from '@shared/domain/content';
import { hasLineTooLongToEdit } from './longLines';

/**
 * A diff is typed into directly when its modified side is a workspace file shown against its own past (the loaded
 * revision, the reviewed copy, or nothing for an added file). Diffs of history, merges and conflicts show other
 * versions of the file and stay read-only, even when one side is the workspace file.
 */
export function canEditInPlace(original: ContentSource, modified: ContentSource): modified is { kind: 'workspaceFile'; path: string } {
  if (modified.kind !== 'workspaceFile') return false;
  if (original.kind === 'empty') return true;
  return (original.kind === 'workspaceBase' || original.kind === 'reviewSnapshot') && original.path === modified.path;
}

/**
 * Whether a diff that can be edited in place is typed into: not when a side has a line too long to type into
 * (`hasLineTooLongToEdit`), where Pierre's editor froze the window at the first keystroke (a minified file of 2 MB).
 */
export function typesIntoDiff(editableInPlace: boolean, texts: readonly string[]): boolean {
  return editableInPlace && !hasLineTooLongToEdit(texts);
}
