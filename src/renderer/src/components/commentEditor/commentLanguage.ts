import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import type { LanguageSupport } from '@codemirror/language';

/**
 * Markdown as the comment editor reads it: GitHub's (tables, task lists, strikethrough, bare links), as the shown
 * comments read it (`parseMarkdown`), with its keys that continue a list on Enter and end it on an empty item. Code
 * in a fence is highlighted by the comments' own highlighter (`codeHighlight`), not by a CodeMirror language.
 */
export function commentMarkdown(): LanguageSupport {
  return markdown({ base: markdownLanguage });
}
