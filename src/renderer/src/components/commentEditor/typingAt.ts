import { StateField } from '@codemirror/state';

/**
 * Where the word being typed ends: the caret after a key typed, and after a Backspace that goes on taking back what
 * was just typed. Suggestions open only there (`suggestionsShownAt`): a field opened, or a caret moved, next to a
 * reference opens none.
 */
export const typingAt = StateField.define<number | null>({
  create: () => null,
  update: (at, transaction) => {
    const main = transaction.state.selection.main;
    if (!main.empty) return null;
    if (transaction.isUserEvent('input.type')) return main.head;
    if (transaction.isUserEvent('delete.backward') && at !== null) return main.head;
    return transaction.docChanged || transaction.selection ? null : at;
  },
});
