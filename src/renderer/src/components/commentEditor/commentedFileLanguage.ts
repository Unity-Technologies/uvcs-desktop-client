import { Compartment, Facet, type Extension } from '@codemirror/state';
import { syntaxLanguage } from '../../lib/syntaxLanguage';

/**
 * The language of the file a comment is on (a review's line comment, its replies and edits), which a ```suggestion
 * fence's code is colored in (`fencedCodeIn`), as the suggestion shows once sent (`suggestionLanguage`). Null for a
 * comment on no file, or one whose language isn't known: the suggestion stays plain.
 */
export const commentedFileLanguage = Facet.define<string | null, string | null>({ combine: (values) => values.find((value) => value !== null) ?? null });

export const commentedFileCompartment = new Compartment();

export function withCommentedFile(path: string | null): Extension {
  const language = path === null ? 'text' : syntaxLanguage(path);
  return commentedFileLanguage.of(language === 'text' ? null : language);
}
