import type { Place } from '@shared/domain/place';
import { discardedFileIn } from './canDiscardChanges';
import { discardInFile, undoLastDiscard } from './discardInFile';
import type { FileBuffer } from './useFileBuffer';
import type { DiscardRequest } from './useLineDiscarding';

export interface DiffDiscards {
  onDiscard: (request: DiscardRequest) => void;
  onUndoDiscard: () => void;
}

/**
 * How a diff discards changes, when it can (`discardedFileIn`, else none). Without unsaved edits a discard is written
 * at once (`discardInFile`), with an undo stack for the session; with some, it's one more edit in the editor: it stays
 * unsaved and ⌘Z takes it back like typing.
 */
export function diffDiscards(place: Place, buffer: FileBuffer, onMatchesBase: (() => void) | undefined): DiffDiscards | null {
  const { original, modified, left } = buffer.shown;
  const file = discardedFileIn(place, original, modified, left);
  if (file === null) return null;
  const target = { ...file, baseText: original.kind === 'workspaceBase' ? (left.text ?? '') : null, onMatchesBase };
  const current = buffer.unsaved ?? buffer.shown.right.text ?? '';
  const dirty = buffer.unsaved !== null;
  return {
    onDiscard: ({ text, done }) => (dirty ? buffer.editor.current?.setText(text) : void discardInFile(target, { before: current, after: text }, done)),
    onUndoDiscard: () => (dirty ? buffer.editor.current?.undo() : void undoLastDiscard(target)),
  };
}
