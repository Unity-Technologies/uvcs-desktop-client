import { EditorSelection, EditorState, type Extension, type Transaction } from '@codemirror/state';
import { commentMarkdown } from './commentLanguage';

/**
 * A comment editor's state for a test, written as the text with where the selection is: `‸` for the caret, `«` and `»`
 * around a selection (the anchor at `«`). No marker puts the caret at the end.
 */
export function editorState(written: string, extensions: Extension = []): EditorState {
  const caret = written.indexOf('‸');
  const anchor = written.indexOf('«');
  const text = written.replace(/[‸«»]/g, '');
  const selection =
    anchor >= 0 ? EditorSelection.single(anchor, written.indexOf('»') - 1) : EditorSelection.cursor(caret >= 0 ? caret : text.length);
  return EditorState.create({ doc: text, selection, extensions: [commentMarkdown(), extensions] });
}

/** The state written back as `editorState` takes it: the text, with the caret or the selection marked. */
export function written(state: EditorState): string {
  const { from, to, empty } = state.selection.main;
  const text = state.doc.toString();
  if (empty) return `${text.slice(0, from)}‸${text.slice(from)}`;
  return `${text.slice(0, from)}«${text.slice(from, to)}»${text.slice(to)}`;
}

/** Runs a command as CodeMirror would, giving back the state it left, or null when it did nothing. */
export function run(command: (target: { state: EditorState; dispatch: (transaction: Transaction) => void }) => boolean, state: EditorState): EditorState | null {
  let next: EditorState | null = null;
  const handled = command({ state, dispatch: (transaction) => (next = transaction.state) });
  return handled ? (next ?? state) : null;
}
