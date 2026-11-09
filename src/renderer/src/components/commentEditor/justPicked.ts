import { StateEffect, StateField } from '@codemirror/state';

/** A suggestion picked (`pickSuggestion`): the reference it wrote. */
export const suggestionPicked = StateEffect.define<{ from: number; to: number }>();

/**
 * The reference a suggestion just wrote, while nothing else happened: drawn as its chip though the caret is against
 * it (`selectionReveals`), as a pick at a line's end or before a sentence's punctuation writes no space after it.
 * Forgotten at the next edit or caret move, which reveals it as any chip.
 */
export const justPicked = StateField.define<{ from: number; to: number } | null>({
  create: () => null,
  update: (picked, transaction) => {
    for (const effect of transaction.effects) if (effect.is(suggestionPicked)) return effect.value;
    return transaction.docChanged || transaction.selection ? null : picked;
  },
});
