import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** The word typed after a trigger, which shows its cue (`suggestionCue`), or none. */
export interface SuggestionCueRange {
  from: number;
  to: number;
}

/** Sets the cue: the editor's suggestions (`useSuggestions`) say where it is. */
export const setSuggestionCue = StateEffect.define<SuggestionCueRange | null>();

const cueMark = Decoration.mark({ class: 'cm-suggestionCue' });

/** The cue on the word typed after a trigger: underlined (docs "Suggestions"). */
export const suggestionCueField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (cue, transaction) => {
    for (const effect of transaction.effects) {
      if (!effect.is(setSuggestionCue)) continue;
      const range = effect.value;
      return range && range.to > range.from ? Decoration.set([cueMark.range(range.from, range.to)]) : Decoration.none;
    }
    return cue.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});
