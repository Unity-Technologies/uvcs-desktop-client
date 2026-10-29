import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** The word typed after a trigger and its cue (`suggestionCue`), or none. */
export interface SuggestionCueRange {
  from: number;
  to: number;
  state: 'reading' | 'ready';
}

/** Sets the cue: the editor's suggestions (`useSuggestions`) say where it is and whether the list is reading. */
export const setSuggestionCue = StateEffect.define<SuggestionCueRange | null>();

const ready = Decoration.mark({ class: 'cm-suggestionCue' });
const reading = Decoration.mark({ class: 'cm-suggestionCue', attributes: { 'data-reading': '' } });

/** The cue on the word typed after a trigger: underlined, pulsing while its list is read (docs "Suggestions"). */
export const suggestionCueField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (cue, transaction) => {
    for (const effect of transaction.effects) {
      if (!effect.is(setSuggestionCue)) continue;
      const range = effect.value;
      return range && range.to > range.from ? Decoration.set([(range.state === 'reading' ? reading : ready).range(range.from, range.to)]) : Decoration.none;
    }
    return cue.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});
