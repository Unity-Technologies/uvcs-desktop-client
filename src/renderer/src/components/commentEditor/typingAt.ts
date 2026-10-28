import { StateField, type Transaction } from '@codemirror/state';
import { hasFocus } from './editorFocus';

/**
 * Where the word being typed ends: the caret after a key typed, and after a Backspace that goes on taking back what
 * was just typed. Suggestions open only there (`suggestionsShownAt`): a field opened, or a caret moved, next to a
 * reference opens none. Leaving the field ends the typing: the focus coming back (Enter from the summary, a click)
 * finds a word typed before, and a list opening on it made the next Enter pick from it.
 */
export const typingAt = StateField.define<number | null>({
  create: () => null,
  update: (at, transaction) => {
    const main = transaction.state.selection.main;
    if (!main.empty || lostFocus(transaction)) return null;
    if (transaction.isUserEvent('input.type')) return main.head;
    if (transaction.isUserEvent('delete.backward') && at !== null) return main.head;
    return transaction.docChanged || transaction.selection ? null : at;
  },
});

/** The focus's mirror (`hasFocus`) going from focused to not, in a field that keeps one. */
function lostFocus(transaction: Transaction): boolean {
  return transaction.startState.field(hasFocus, false) === true && transaction.state.field(hasFocus, false) === false;
}
