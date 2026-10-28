import { StateField } from '@codemirror/state';

/**
 * Where the word being typed ends: the caret after a key typed, and after a Backspace that goes on taking back what
 * was just typed. A reference ending there shows as typed rather than as a chip (`liveMarksOf`), so `cs:12` can be
 * typed and corrected a key at a time; once the caret moves away, or a suggestion is picked, it's a chip, one piece.
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
