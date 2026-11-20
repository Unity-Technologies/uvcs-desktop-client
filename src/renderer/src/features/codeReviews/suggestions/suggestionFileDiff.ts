import { parseDiffFromFile, type FileDiffMetadata } from '@pierre/diffs';
import { replacedThenSuggested } from './replacedThenSuggested';
import type { SuggestionBody } from './suggestedChange';
import { suggestionLanguage } from './suggestionLanguage';
import { suggestionLineDiff } from './suggestionLineDiff';
import type { SuggestionView } from './suggestionViewStore';

/**
 * The diff a Suggested change box shows (`SuggestionDiff`): the lines replaced to those suggested, as two whole files,
 * so Pierre marks the words they change as it does the code's own diff, numbered from the first line commented: as the
 * user chose (`SuggestionView`), stacked (`replacedThenSuggested`) or as a diff (`suggestionLineDiff`), the lines kept
 * shown once. Highlighted in the file's language (`suggestionLanguage`: plain for a language not known, or past the
 * size a comment's code is highlighted to).
 */
export function suggestionFileDiff(path: string, { replacedText, suggestedText, firstLine }: Pick<Extract<SuggestionBody, { kind: 'diff' }>, 'replacedText' | 'suggestedText' | 'firstLine'>, view: SuggestionView): FileDiffMetadata {
  const lang = suggestionLanguage(replacedText + suggestedText, path) ?? 'text';
  const replaced = { name: path, contents: replacedText };
  const suggested = { name: path, contents: suggestedText, lang };
  return view === 'stacked' ? replacedThenSuggested(parseDiffFromFile(replaced, suggested), firstLine) : suggestionLineDiff(replaced, suggested, firstLine);
}
