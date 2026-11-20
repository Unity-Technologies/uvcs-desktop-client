import type { SuggestionView } from './suggestionViewStore';

/**
 * The box header's switch between its two views (`SuggestionView`): pressed while it shows the diff, its tooltip saying
 * what a click shows.
 */
export function suggestionViewToggle(view: SuggestionView): { label: string; pressed: boolean; next: SuggestionView } {
  return view === 'diff' ? { label: 'Show the lines stacked', pressed: true, next: 'stacked' } : { label: 'Show as a diff', pressed: false, next: 'diff' };
}
