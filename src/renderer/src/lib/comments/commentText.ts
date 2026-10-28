import { parseInline, parseMarkdown, plainText, type MarkdownBlock } from '../markdown';
import { firstLine } from '../text';

/**
 * A comment's first line as plain text, for what shows only text (the Branch Explorer's canvas, notifications, the
 * palette): its Markdown marks left out, references as written, emoji as themselves.
 */
export function commentLineText(comment: string): string {
  return plainText(parseInline(firstLine(comment), { comment: true })).trim();
}

/** A whole comment as plain text, a line per line it shows, for a tooltip that holds only text. */
export function commentText(comment: string): string {
  return parseMarkdown(comment, { comment: true }).flatMap(blockLines).join('\n');
}

function blockLines(block: MarkdownBlock): string[] {
  switch (block.kind) {
    case 'code':
      return block.text.split('\n');
    case 'list':
      return block.items.map((item, index) => `${block.ordered ? `${(block.start ?? 1) + index}.` : '•'} ${plainText(item.children)}`);
    case 'quote':
      return block.children.flatMap(blockLines);
    case 'table':
      return [block.header, ...block.rows].map((row) => row.map(plainText).join(' · '));
    case 'rule':
      return [];
    default:
      // A line break inside a paragraph reads as a space in `plainText`; here it stays a line.
      return block.children.reduce<string[]>(
        (lines, inline) => (inline.kind === 'break' ? [...lines, ''] : [...lines.slice(0, -1), (lines.at(-1) ?? '') + plainText([inline])]),
        [''],
      );
  }
}
