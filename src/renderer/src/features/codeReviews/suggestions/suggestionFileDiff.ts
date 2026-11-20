import type { FileDiffMetadata } from '@pierre/diffs';
import type { SuggestionBody } from './suggestedChange';
import { suggestionLanguage } from './suggestionLanguage';
import { suggestionLineDiff } from './suggestionLineDiff';

/**
 * The diff a Suggested change box shows (`SuggestionDiff`): the lines replaced to those suggested, as two whole files,
 * so Pierre marks the words they change as it does the code's own diff, the lines kept shown once, numbered from the
 * first line commented (`suggestionLineDiff`). Highlighted in the file's
 * language (`suggestionLanguage`: plain for a language not known, or past the size a comment's code is highlighted to).
 */
export function suggestionFileDiff(path: string, { replacedText, suggestedText, firstLine }: Pick<Extract<SuggestionBody, { kind: 'diff' }>, 'replacedText' | 'suggestedText' | 'firstLine'>): FileDiffMetadata {
  const lang = suggestionLanguage(replacedText + suggestedText, path) ?? 'text';
  return suggestionLineDiff({ name: path, contents: replacedText }, { name: path, contents: suggestedText, lang }, firstLine);
}
