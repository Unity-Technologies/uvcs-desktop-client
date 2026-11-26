import type { CodeComparison } from '../../diff/viewer/codeComparison';
import { rangeWordsInline } from '../../../lib/rangeWords';
import type { SuggestedChange, SuggestionBody } from './suggestedChange';
import { suggestionFileDiff } from './suggestionFileDiff';

/**
 * A suggestion as Compare opens it (`openSuggestionComparison`): the line diff of the commented lines against the
 * suggested ones (`suggestionFileDiff`'s `diff`), numbered as the file's lines, in a dialog wide enough for them side
 * by side, whichever way its box shows them.
 */
export function suggestionComparison(path: string, body: Extract<SuggestionBody, { kind: 'diff' }>): CodeComparison {
  const meta = suggestionFileDiff(path, body, 'diff');
  const count = (side: 'additionLines' | 'deletionLines') => meta.hunks.reduce((lines, hunk) => lines + hunk[side], 0);
  return { kind: 'diff', diff: { meta, options: {}, added: count('additionLines'), removed: count('deletionLines') } };
}

/** The dialog's title: what it shows, and where. */
export function suggestionComparisonTitle(change: Pick<SuggestedChange, 'firstLine' | 'lastLine'>): string {
  return `Suggested change on ${rangeWordsInline(change)}`;
}
