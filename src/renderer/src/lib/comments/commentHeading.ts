import { splitComment } from '../comment';
import { parseInline, parseMarkdown, type MarkdownBlock, type MarkdownInline } from '../markdown';

/** How a comment shows as a heading: its title over its description (docs/features/rich-comments.md). */
export interface CommentHeading {
  /**
   * The first line as written (Markdown of one line), or null when the comment opens with a block (a list, code, a
   * table, a quote, a rule): that line alone would cut the block, which shows whole as the description instead.
   */
  title: string | null;
  /** What shows under the title: the rest of the comment, or all of it when it has no title. */
  description: string;
}

/** A comment's title and description, as a details panel, a diff's header or History's revision shows them. */
export function commentHeading(comment: string): CommentHeading {
  const { summary, description } = splitComment(comment);
  if (!summary) return { title: null, description: '' };
  const opening = parseMarkdown(comment, { comment: true })[0];
  if (opening && opening.kind !== 'paragraph' && opening.kind !== 'heading') return { title: null, description: comment.trim() };
  return { title: summary, description };
}

/**
 * A comment as one line, as a row, a title or a tooltip shows it: its title's inline formatting, or, for a comment
 * that opens with a block, that block's first line (a list's first item with its marker, code's first line, a table's
 * header). Empty for an empty comment, where the caller says "No comment".
 */
export function commentLineInlines(comment: string): MarkdownInline[] {
  const { title, description } = commentHeading(comment);
  if (title !== null) return parseInline(title, { comment: true });
  const opening = parseMarkdown(description, { comment: true })[0];
  return opening ? lineOfBlock(opening) : [];
}

function lineOfBlock(block: MarkdownBlock): MarkdownInline[] {
  switch (block.kind) {
    case 'list': {
      const first = block.items[0];
      if (!first) return [];
      const marker = block.ordered ? `${block.start ?? 1}. ` : first.checked === undefined ? '• ' : first.checked ? '☑ ' : '☐ ';
      return [{ kind: 'text', text: marker }, ...first.children];
    }
    case 'code':
      return [{ kind: 'code', text: block.text.split('\n')[0] ?? '' }];
    case 'table':
      return block.header.flatMap((cell, index) => (index === 0 ? cell : [{ kind: 'text', text: ' · ' } as const, ...cell]));
    case 'quote':
      return block.children[0] ? lineOfBlock(block.children[0]) : [];
    case 'rule':
      return [];
    default:
      return block.children;
  }
}
