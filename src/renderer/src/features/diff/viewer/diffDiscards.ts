import { canDiscardChanges } from './canDiscardChanges';
import { discardInFile, undoLastDiscard } from './discardInFile';
import type { FileBuffer } from './useFileBuffer';
import type { DiscardRequest } from './useLineDiscarding';

export interface DiffDiscards {
  onDiscard: (request: DiscardRequest) => void;
  onUndoDiscard: () => void;
}

/**
 * How a diff discards changes, when it can (`canDiscardChanges`, else none). Without unsaved edits a discard is written
 * at once (`discardInFile`), with an undo stack for the session; with some, it's one more edit in the editor: it stays
 * unsaved and ⌘Z takes it back like typing.
 */
export function diffDiscards(workspacePath: string, buffer: FileBuffer, onMatchesBase: (() => void) | undefined): DiffDiscards | null {
  const { original, modified, left } = buffer.shown;
  if (!canDiscardChanges(original, modified)) return null;
  const target = { workspacePath, path: modified.path, baseText: original.kind === 'workspaceBase' ? (left.text ?? '') : null, onMatchesBase };
  const current = buffer.unsaved ?? buffer.shown.right.text ?? '';
  const dirty = buffer.unsaved !== null;
  return {
    onDiscard: ({ text, done }) => (dirty ? buffer.editor.current?.setText(text) : void discardInFile(target, { before: current, after: text }, done)),
    onUndoDiscard: () => (dirty ? buffer.editor.current?.undo() : void undoLastDiscard(target)),
  };
}
