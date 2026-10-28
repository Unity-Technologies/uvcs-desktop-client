import { splitComment } from '../comment';
import { parseMarkdown, type MarkdownBlock, type MarkdownInline } from '../markdown';

/**
 * How a comment shows as a heading (docs/features/rich-comments.md, "Where comments show"), the one decision every
 * header and row takes:
 * - `titled`: its first line as the title, the rest as the description; a list's or a quote's first line keeps its
 *   marker (`• Tidied the README`, `3. Fix the build`) and the rest of the list follows it, so nothing shows twice.
 * - `block`: it opens with code or a table, which its first line alone would cut: the comment shows whole.
 * - `empty`: there is no comment ("No comment").
 */
export type CommentHeading =
  | { kind: 'titled'; title: MarkdownInline[]; description: string }
  | { kind: 'block'; description: string }
  | { kind: 'empty' };

export function commentHeading(comment: string): CommentHeading {
  const { summary, description } = splitComment(comment);
  if (!summary) return { kind: 'empty' };
  const opening = openingBlock(comment);
  // A rule it opens with only separates: the heading is what follows it.
  if (opening?.kind === 'rule') return description ? commentHeading(description) : { kind: 'empty' };
  if (!opening || opening.kind === 'code' || opening.kind === 'table') return { kind: 'block', description: comment.trim() };
  return { kind: 'titled', title: firstLineOf(opening), description };
}

/**
 * A comment as one line, as a row, a title or a tooltip shows it: its title, or for one that opens with code or a
 * table, that block's first line (code's first line, the table's header). Empty for an empty comment, where the
 * caller says "No comment".
 */
export function commentLineInlines(comment: string): MarkdownInline[] {
  const heading = commentHeading(comment);
  switch (heading.kind) {
    case 'titled':
      return heading.title;
    case 'block': {
      const opening = openingBlock(heading.description);
      return opening ? firstLineOf(opening) : [];
    }
    case 'empty':
      return [];
  }
}

/**
 * The block a comment opens with, read from its first lines only (up to the first blank line, where a block ends):
 * a row with a long pasted log costs what its first paragraph does. Code cut there still reads as code.
 */
function openingBlock(comment: string): MarkdownBlock | undefined {
  const text = comment.replace(/\r\n?/g, '\n').replace(/^\s*\n/, '');
  const blank = text.search(/\n[ \t]*\n/);
  return parseMarkdown(blank < 0 ? text : text.slice(0, blank), { comment: true })[0];
}

/** A block's first line: a paragraph up to its first line break, a list's first item with its marker. */
function firstLineOf(block: MarkdownBlock): MarkdownInline[] {
  switch (block.kind) {
    case 'paragraph':
    case 'heading': {
      const lineBreak = block.children.findIndex((inline) => inline.kind === 'break');
      return lineBreak < 0 ? block.children : block.children.slice(0, lineBreak);
    }
    case 'list': {
      const first = block.items[0];
      if (!first) return [];
      const marker = block.ordered ? `${block.start ?? 1}. ` : first.checked === undefined ? '• ' : first.checked ? '☑ ' : '☐ ';
      return [{ kind: 'text', text: marker }, ...firstLineOf({ kind: 'paragraph', children: first.children })];
    }
    case 'code':
      return [{ kind: 'code', text: block.text.split('\n')[0] ?? '' }];
    case 'table':
      return block.header.flatMap((cell, index) => (index === 0 ? cell : [{ kind: 'text', text: ' · ' } as const, ...cell]));
    case 'quote':
      return block.children[0] ? firstLineOf(block.children[0]) : [];
    case 'rule':
      return [];
  }
}
