import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { HighlightStyle, type LanguageSupport } from '@codemirror/language';
import { styleTags, Tag, tags } from '@lezer/highlight';

/**
 * Inline code alone: Markdown's reader tags a code block's text `monospace` as well (`CodeText`), and a code block is
 * drawn as a block, in the text's color, never as inline code (`Markdown.module.css`'s `pre code`).
 */
const inlineCode = Tag.define(tags.monospace);

/**
 * Markdown as the comment editor reads it: GitHub's (tables, task lists, strikethrough, bare links), as the shown
 * comments read it (`parseMarkdown`), with its keys that continue a list on Enter and end it on an empty item. Code
 * in a fence is highlighted by the comments' own highlighter (`codeHighlight`), not by a CodeMirror language.
 */
export function commentMarkdown(): LanguageSupport {
  return markdown({ base: markdownLanguage, extensions: [{ props: [styleTags({ InlineCode: inlineCode })] }] });
}

/** Text the editor colors with the app's tokens (`LiveCommentEditor.module.css`): Markdown's own, around the caret. */
export const commentMarkdownStyle = HighlightStyle.define([
  { tag: tags.heading1, class: 'cm-heading1' },
  { tag: tags.heading2, class: 'cm-heading2' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], class: 'cm-heading3' },
  { tag: tags.strong, class: 'cm-strong' },
  { tag: tags.emphasis, class: 'cm-emphasis' },
  { tag: tags.strikethrough, class: 'cm-strikethrough' },
  { tag: inlineCode, class: 'cm-inlineCode' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator, tags.url], class: 'cm-markup' },
  { tag: tags.quote, class: 'cm-quote' },
]);
