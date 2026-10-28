import { parseMarkdown, plainText, type MarkdownBlock } from '../markdown';
import { firstLine } from '../text';
import { commentLineInlines } from './commentHeading';
import { mayHoldReference } from './commentReferences';

/**
 * What Markdown could read in a first line: without any (and no reference, `mayHoldReference`), the line is its own
 * text and needs no parsing: the Branch Explorer asks for thousands of comments' lines as it draws, and "Fix: crash"
 * is plain. A heading underlined on the next line (`===`) reads as the line itself too.
 */
const MARKDOWN_CHARACTERS = /[*_~`[\]<>|&\\]|https?:|www\./;
const BLOCK_START = /^\s*(?:[-+>]|#{1,6}(?:\s|$)|\d+[.)](?:\s|$)|```|~~~)/;

/**
 * A comment as one line of plain text (`commentLineInlines`), for what shows only text (the Branch Explorer's canvas,
 * notifications, the palette): its Markdown marks left out, references as written, emoji as themselves.
 */
export function commentLineText(comment: string): string {
  const line = firstLine(comment);
  if (!MARKDOWN_CHARACTERS.test(line) && !BLOCK_START.test(line) && !mayHoldReference(line)) return line;
  return plainText(commentLineInlines(comment)).trim();
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
