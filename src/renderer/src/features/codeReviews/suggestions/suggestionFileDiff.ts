import { parseDiffFromFile, type FileDiffMetadata } from '@pierre/diffs';
import { replacedThenSuggested } from './replacedThenSuggested';
import type { SuggestionBody } from './suggestedChange';
import { suggestionLanguage } from './suggestionLanguage';

/**
 * The diff a Suggested change box shows (`SuggestionDiff`): the lines replaced to those suggested, as two whole files,
 * so Pierre lays them out and marks the words they change as it does the code's own diff, each changed part read as
 * the lines replaced, then the lines suggested (`replacedThenSuggested`). Highlighted in the file's
 * language (`suggestionLanguage`: plain for a language not known, or past the size a comment's code is highlighted to).
 */
export function suggestionFileDiff(path: string, { replacedText, suggestedText }: Pick<Extract<SuggestionBody, { kind: 'diff' }>, 'replacedText' | 'suggestedText'>): FileDiffMetadata {
  const lang = suggestionLanguage(replacedText + suggestedText, path) ?? 'text';
  return replacedThenSuggested(parseDiffFromFile({ name: path, contents: replacedText }, { name: path, contents: suggestedText, lang }));
}
