import { openCodeComparisonDialog } from '../../diff/viewer/CodeComparisonDialog';
import type { SuggestedChange, SuggestionBody } from './suggestedChange';
import { suggestionComparison, suggestionComparisonTitle } from './suggestionComparison';

/**
 * Opens a suggestion in a dialog (Compare, in its box's header): a suggestion rewriting a method reads best with the
 * commented code beside it, which a comment, as narrow as the thread, has no room for. Split or unified as the user
 * last chose, there or in any diff (`useDiffPreferences`).
 */
export function openSuggestionComparison(change: SuggestedChange, body: Extract<SuggestionBody, { kind: 'diff' }>): void {
  openCodeComparisonDialog({
    title: suggestionComparisonTitle(change),
    description: change.path,
    comparison: suggestionComparison(change.path, body),
    fileName: change.path,
  });
}
