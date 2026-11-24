import { highlightedLanguage } from '../../../components/comments/codeBlockLanguage';
import { syntaxLanguage } from '../../../lib/syntaxLanguage';

/**
 * The language a suggestion's rows are highlighted in: its file's (`syntaxLanguage`), decided as a comment's code block
 * is (`highlightedLanguage`: none past the size a comment's code is highlighted to); none for a file whose language
 * isn't known, which shows plain. Loaded with the highlighted rows, never at start-up, as `syntaxLanguage` is Pierre's.
 */
export function suggestionLanguage(text: string, path: string): string | null {
  const language = syntaxLanguage(path);
  return language === 'text' ? null : highlightedLanguage(text, language);
}
