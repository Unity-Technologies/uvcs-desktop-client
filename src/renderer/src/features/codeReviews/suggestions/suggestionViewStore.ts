import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * How a Suggested change box shows its lines (docs/features/code-reviews.md "Suggested changes"): `stacked`, every
 * line commented then every line suggested (`replacedThenSuggested`), as GitHub and GitLab show one; `diff`, the line
 * diff of the two (`suggestionLineDiff`), the lines kept shown once. Stacked reads a rewrite best, the diff a few words
 * changed in a longer range.
 */
export type SuggestionView = 'stacked' | 'diff';

interface SuggestionViewState {
  view: SuggestionView;
  setView: (view: SuggestionView) => void;
}

/** The user's choice, for every suggestion in every review. */
export const useSuggestionViewStore = create<SuggestionViewState>()(
  persist((set) => ({ view: 'stacked', setView: (view) => set({ view }) }), { name: 'suggestion-view', version: 1 }),
);
