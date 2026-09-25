/**
 * A small Markdown reader for texts people write in version control (release notes, comments):
 * headings, paragraphs, lists, quotes, code, emphasis and links. It builds a tree to render as
 * React elements, so no HTML from the text ever reaches the page.
 */
export type MarkdownInline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: MarkdownInline[] }
  | { kind: 'emphasis'; children: MarkdownInline[] }
  | { kind: 'link'; url: string; children: MarkdownInline[] };

export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; children: MarkdownInline[] }
  | { kind: 'paragraph'; children: MarkdownInline[] }
  | { kind: 'list'; ordered: boolean; items: MarkdownInline[][] }
  | { kind: 'quote'; children: MarkdownInline[] }
  | { kind: 'code'; text: string };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const FENCE = /^\s*(```|~~~)/;

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  const collect = (pattern: RegExp): string[] => {
    const collected: string[] = [];
    while (index < lines.length && pattern.test(lines[index]!)) collected.push(lines[index++]!.match(pattern)![1]!);
    return collected;
  };

  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      index++;
    } else if (FENCE.test(line)) {
      const fence = line.match(FENCE)![1]!;
      const code: string[] = [];
      index++;
      while (index < lines.length && !lines[index]!.trim().startsWith(fence)) code.push(lines[index++]!);
      index++;
      blocks.push({ kind: 'code', text: code.join('\n') });
    } else if (HEADING.test(line)) {
      const [, hashes, text] = line.match(HEADING)!;
      blocks.push({ kind: 'heading', level: Math.min(hashes!.length, 3) as 1 | 2 | 3, children: parseInline(text!.replace(/\s+#+\s*$/, '')) });
      index++;
    } else if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = !BULLET.test(line);
      blocks.push({ kind: 'list', ordered, items: collect(ordered ? NUMBERED : BULLET).map(parseInline) });
    } else if (QUOTE.test(line)) {
      blocks.push({ kind: 'quote', children: parseInline(collect(QUOTE).join(' ')) });
    } else {
      const paragraph: string[] = [];
      while (index < lines.length && lines[index]!.trim() && !startsBlock(lines[index]!)) paragraph.push(lines[index++]!.trim());
      blocks.push({ kind: 'paragraph', children: parseInline(paragraph.join(' ')) });
    }
  }
  return blocks;
}

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || BULLET.test(line) || NUMBERED.test(line) || QUOTE.test(line);
}

// Code first, so nothing inside backticks is read as emphasis or links.
const INLINE = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s][^*]*)\*|\b_([^_\s][^_]*)_\b|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

export function parseInline(text: string): MarkdownInline[] {
  const parts: MarkdownInline[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > cursor) parts.push({ kind: 'text', text: text.slice(cursor, match.index) });
    const [, code, linkText, linkUrl, strong, strongAlt, emphasis, emphasisAlt, bareUrl] = match;
    if (code !== undefined) parts.push({ kind: 'code', text: code });
    else if (linkText !== undefined) parts.push({ kind: 'link', url: linkUrl!, children: parseInline(linkText) });
    else if (strong !== undefined || strongAlt !== undefined) parts.push({ kind: 'strong', children: parseInline((strong ?? strongAlt)!) });
    else if (emphasis !== undefined || emphasisAlt !== undefined) parts.push({ kind: 'emphasis', children: parseInline((emphasis ?? emphasisAlt)!) });
    else parts.push({ kind: 'link', url: bareUrl!, children: [{ kind: 'text', text: bareUrl! }] });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) });
  return parts;
}

/** The text without Markdown marks, e.g. for a one-line preview. */
export function markdownPreview(source: string): string {
  return parseMarkdown(source)
    .map((block) => (block.kind === 'code' ? block.text : block.kind === 'list' ? block.items.map(plainText).join(' · ') : plainText(block.children)))
    .join(' — ');
}

function plainText(inlines: MarkdownInline[]): string {
  return inlines.map((inline) => (inline.kind === 'text' || inline.kind === 'code' ? inline.text : plainText(inline.children))).join('');
}
