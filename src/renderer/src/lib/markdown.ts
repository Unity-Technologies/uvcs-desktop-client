import type { Nodes, Parent, PhrasingContent, RootContent, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { findReferences, type CommentReference, type FoundReference } from './comments/commentReferences';

/**
 * Markdown as people write it in version control (comments, release notes, attribute values), read by micromark as
 * CommonMark with GitHub's extensions (tables, task lists, strikethrough, bare links), into a tree the app renders as
 * React elements: no HTML from the text ever reaches the page, and raw HTML in it reads as the text it is.
 */
export type MarkdownInline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: MarkdownInline[] }
  | { kind: 'emphasis'; children: MarkdownInline[] }
  | { kind: 'strike'; children: MarkdownInline[] }
  | { kind: 'link'; url: string; children: MarkdownInline[] }
  | { kind: 'image'; url: string; alt: string }
  /** A key, written `<kbd>Ctrl</kbd>`: the one HTML element read as such, as GitHub reads it. */
  | { kind: 'key'; text: string }
  | { kind: 'break' }
  /** A changeset, branch, person, emoji… a comment names (`commentReferences`), and the text it was written as. */
  | { kind: 'reference'; reference: CommentReference; source: string };

export interface MarkdownList {
  kind: 'list';
  ordered: boolean;
  /** The first item's number, when the list doesn't start at 1. */
  start?: number;
  items: MarkdownListItem[];
}

/** One item of a list: its text, the list nested under it, and its box in a task list (`- [x]`). */
export interface MarkdownListItem {
  children: MarkdownInline[];
  sublist?: MarkdownList;
  checked?: boolean;
}

export type TableAlignment = 'left' | 'center' | 'right' | null;

export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; children: MarkdownInline[] }
  | { kind: 'paragraph'; children: MarkdownInline[] }
  | MarkdownList
  | { kind: 'quote'; children: MarkdownBlock[] }
  | { kind: 'code'; text: string; language?: string }
  | { kind: 'table'; align: TableAlignment[]; header: MarkdownInline[][]; rows: MarkdownInline[][][] }
  | { kind: 'rule' };

export interface MarkdownOptions {
  /**
   * Comments: their references read (`commentReferences`), and each line break kept, as GitHub shows a comment and
   * as the app showed comments before reading them as Markdown. Release notes and attribute values join a
   * paragraph's lines, as CommonMark does.
   */
  comment?: boolean;
}

/**
 * The only schemes a link opens: web pages (in the browser) and the app's own links. A mail link shows its text: the
 * app opens nothing else outside it (`openExternal` takes web pages only).
 */
const OPENED_SCHEMES = /^(https?:|uvcs:)/i;

export function parseMarkdown(source: string, options: MarkdownOptions = {}): MarkdownBlock[] {
  return new MarkdownReader(source, options).blocks();
}

/**
 * The inlines of a text's first block, its marks of a heading, a list item or a quote left out: a comment's first
 * line in a list row (inline formatting only) or a title.
 */
export function parseInline(text: string, options: MarkdownOptions = {}): MarkdownInline[] {
  const first = parseMarkdown(text, options)[0];
  return first ? inlinesOfBlock(first) : [];
}

function inlinesOfBlock(block: MarkdownBlock): MarkdownInline[] {
  switch (block.kind) {
    case 'heading':
    case 'paragraph':
      return block.children;
    case 'list':
      return block.items[0]?.children ?? [];
    case 'quote':
      return block.children[0] ? inlinesOfBlock(block.children[0]) : [];
    case 'code':
      return [{ kind: 'text', text: block.text.split('\n')[0] ?? '' }];
    case 'table':
      return block.header.flatMap((cell, index) => (index === 0 ? cell : [{ kind: 'text', text: ' · ' } as MarkdownInline, ...cell]));
    case 'rule':
      return [];
  }
}

/** The text without Markdown marks, e.g. for a one-line preview. */
export function markdownPreview(source: string): string {
  return parseMarkdown(source)
    .map(blockText)
    .filter(Boolean)
    .join(' — ');
}

function blockText(block: MarkdownBlock): string {
  switch (block.kind) {
    case 'code':
      return block.text;
    case 'list':
      return block.items.map((item) => plainText(item.children)).join(' · ');
    case 'quote':
      return block.children.map(blockText).join(' ');
    case 'table':
      return [block.header, ...block.rows].map((row) => row.map(plainText).join(' · ')).join(' — ');
    case 'rule':
      return '';
    default:
      return plainText(block.children);
  }
}

/** The text of a line without its marks: references as written, emoji as themselves, images by their description. */
export function plainText(inlines: readonly MarkdownInline[]): string {
  return inlines.map(inlineText).join('');
}

function inlineText(inline: MarkdownInline): string {
  switch (inline.kind) {
    case 'text':
    case 'code':
    case 'key':
      return inline.text;
    case 'image':
      return inline.alt;
    case 'break':
      return ' ';
    case 'reference':
      return inline.reference.kind === 'emoji' ? inline.reference.glyph : inline.source;
    default:
      return plainText(inline.children);
  }
}

function readTree(source: string): Root {
  return fromMarkdown(source, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

/**
 * Where a reference stands for itself in a comment: one shown as written, the rest of it an opaque placeholder
 * Markdown reads as text. References are found in the comment as written, so what Markdown would read in them
 * never splits one (a server's host as a bare mail link, `__init__` as emphasis); those inside code, a link or an
 * image stay the text they are.
 */
const PLACEHOLDER = /\uE000(\d+)\uE001/g;

/** Reads micromark's syntax tree into the app's, with the link definitions a reference-style link points to. */
class MarkdownReader {
  private readonly tree: Root;
  private readonly definitions = new Map<string, string>();
  private readonly references: FoundReference[] = [];

  constructor(
    source: string,
    private readonly options: MarkdownOptions,
  ) {
    const text = source.replace(/\r\n?/g, '\n');
    const found = options.comment ? findReferences(text) : [];
    if (found.length > 0) {
      const written = writtenRanges(readTree(text), text);
      this.references = found.filter((reference) => !written.some(([from, to]) => reference.from < to && reference.to > from));
    }
    this.tree = readTree(withPlaceholders(text, this.references));
    for (const node of this.tree.children) if (node.type === 'definition') this.definitions.set(node.identifier, node.url);
  }

  blocks(): MarkdownBlock[] {
    return this.blocksOf(this.tree.children);
  }

  private blocksOf(nodes: readonly RootContent[]): MarkdownBlock[] {
    return nodes.flatMap((node) => this.block(node));
  }

  private block(node: RootContent): MarkdownBlock[] {
    switch (node.type) {
      case 'heading':
        return [{ kind: 'heading', level: Math.min(node.depth, 3) as 1 | 2 | 3, children: this.inlines(node.children) }];
      case 'paragraph':
        return [{ kind: 'paragraph', children: this.inlines(node.children) }];
      case 'blockquote':
        return [{ kind: 'quote', children: this.blocksOf(node.children) }];
      case 'list':
        return [this.list(node)];
      case 'code':
        return [node.lang ? { kind: 'code', text: node.value, language: node.lang } : { kind: 'code', text: node.value }];
      case 'table': {
        const [header, ...rows] = node.children.map((row) => row.children.map((cell) => this.inlines(cell.children)));
        return [{ kind: 'table', align: (node.align ?? []).map((align) => align ?? null), header: header ?? [], rows }];
      }
      case 'thematicBreak':
        return [{ kind: 'rule' }];
      case 'html':
        return [{ kind: 'paragraph', children: this.textInlines(node.value) }];
      case 'footnoteDefinition':
        return this.blocksOf(node.children);
      default:
        // Definitions say where reference-style links lead; they show nothing themselves.
        return [];
    }
  }

  private list(node: Extract<RootContent, { type: 'list' }>): MarkdownList {
    const items = node.children.map((item): MarkdownListItem => {
      const children: MarkdownInline[] = [];
      let sublist: MarkdownList | undefined;
      for (const child of item.children) {
        if (child.type === 'list') sublist = this.list(child);
        else {
          // What an item holds beyond its text (a second paragraph, code) reads on as its lines.
          if (children.length > 0) children.push({ kind: 'break' });
          children.push(...this.inlinesOfAny(child));
        }
      }
      const listItem: MarkdownListItem = { children };
      if (sublist) listItem.sublist = sublist;
      if (typeof item.checked === 'boolean') listItem.checked = item.checked;
      return listItem;
    });
    const list: MarkdownList = { kind: 'list', ordered: Boolean(node.ordered), items };
    if (node.ordered && typeof node.start === 'number' && node.start !== 1) list.start = node.start;
    return list;
  }

  private inlinesOfAny(node: RootContent): MarkdownInline[] {
    if (node.type === 'code') return [{ kind: 'code', text: node.value }];
    if ('children' in node) return this.inlines(node.children as PhrasingContent[]);
    return 'value' in node ? this.textInlines(String(node.value)) : [];
  }

  private inlines(nodes: readonly PhrasingContent[]): MarkdownInline[] {
    const inlines: MarkdownInline[] = [];
    for (let index = 0; index < nodes.length; index++) {
      const closing = keyClosingAt(nodes, index);
      if (closing < 0) {
        inlines.push(...this.inline(nodes[index]!));
        continue;
      }
      // What a key holds reads as written, a reference included (`<kbd>cs:12</kbd>`).
      inlines.push({ kind: 'key', text: plainText(this.inlines(nodes.slice(index + 1, closing))) });
      index = closing;
    }
    return joinedTexts(inlines);
  }

  private inline(node: PhrasingContent): MarkdownInline[] {
    switch (node.type) {
      case 'text':
        return this.textInlines(node.value);
      case 'inlineCode':
        return [{ kind: 'code', text: node.value }];
      case 'strong':
        return [{ kind: 'strong', children: this.inlines(node.children) }];
      case 'emphasis':
        return [{ kind: 'emphasis', children: this.inlines(node.children) }];
      case 'delete':
        return [{ kind: 'strike', children: this.inlines(node.children) }];
      case 'break':
        return [{ kind: 'break' }];
      case 'link':
        return this.link(node.url, this.inlines(node.children));
      case 'linkReference': {
        const url = this.definitions.get(node.identifier);
        return url ? this.link(url, this.inlines(node.children)) : this.textInlines(textOf(node));
      }
      case 'image':
        return this.image(node.url, node.alt ?? '');
      case 'imageReference': {
        const url = this.definitions.get(node.identifier);
        return url ? this.image(url, node.alt ?? '') : this.textInlines(node.alt ?? '');
      }
      case 'footnoteReference':
        return [{ kind: 'text', text: `[${node.label ?? node.identifier}]` }];
      case 'html':
        return this.textInlines(node.value);
    }
  }

  private link(url: string, children: MarkdownInline[]): MarkdownInline[] {
    return OPENED_SCHEMES.test(url) ? [{ kind: 'link', url, children }] : children;
  }

  private image(url: string, alt: string): MarkdownInline[] {
    return /^https?:/i.test(url) ? [{ kind: 'image', url, alt }] : this.textInlines(alt);
  }

  /** Text, its line breaks kept in a comment and its references put back; joined as CommonMark does elsewhere. */
  private textInlines(text: string): MarkdownInline[] {
    if (!this.options.comment) return text ? [{ kind: 'text', text: text.replace(/\n/g, ' ') }] : [];
    return text.split('\n').flatMap((line, index) => [...(index > 0 ? [{ kind: 'break' } as const] : []), ...this.referencesIn(line)]);
  }

  private referencesIn(text: string): MarkdownInline[] {
    const inlines: MarkdownInline[] = [];
    let cursor = 0;
    for (const placeholder of text.matchAll(PLACEHOLDER)) {
      // The comment's own text may hold what reads as a placeholder (icon fonts' private-use glyphs): it stays text.
      const found = this.references[Number(placeholder[1])];
      if (!found) continue;
      if (placeholder.index > cursor) inlines.push({ kind: 'text', text: text.slice(cursor, placeholder.index) });
      inlines.push({ kind: 'reference', reference: found.reference, source: found.source });
      cursor = placeholder.index + placeholder[0].length;
    }
    if (cursor < text.length) inlines.push({ kind: 'text', text: text.slice(cursor) });
    return inlines;
  }
}

/** The comment with each reference in its placeholder's place, from the last so the earlier ones keep their places. */
function withPlaceholders(text: string, references: readonly FoundReference[]): string {
  let written = text;
  for (let index = references.length - 1; index >= 0; index--) {
    const { from, to } = references[index]!;
    written = `${written.slice(0, from)}\uE000${index}\uE001${written.slice(to)}`;
  }
  return written;
}

/**
 * Where a comment shows what was written as it is, so no reference is read there: code, raw HTML, an image, and a
 * link, a bare web address included (`https://ci/job?BRANCH=br:/main` stays one address). A bare email address
 * isn't one of them: a reference may hold what reads as one (`cs:12@game@build.acme.com`).
 */
function writtenRanges(tree: Root, text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const visit = (node: Nodes): void => {
    const from = node.position?.start.offset;
    const to = node.position?.end.offset;
    if (from !== undefined && to !== undefined && isWrittenAsIs(node, text.slice(from, to))) {
      ranges.push([from, to]);
      return;
    }
    if ('children' in node) for (const child of (node as Parent).children) visit(child as Nodes);
  };
  visit(tree);
  return ranges;
}

function isWrittenAsIs(node: Nodes, written: string): boolean {
  switch (node.type) {
    case 'inlineCode':
    case 'code':
    case 'html':
    case 'image':
    case 'imageReference':
    case 'linkReference':
    case 'definition':
      return true;
    case 'link':
      return !node.url.startsWith('mailto:') || written.startsWith('[') || written.startsWith('<');
    default:
      return false;
  }
}

const KEY_OPENING = /^<kbd>$/i;
const KEY_CLOSING = /^<\/kbd>$/i;

/** Where the `</kbd>` closing a `<kbd>` at `index` is, among its siblings; -1 when `index` opens no key. */
function keyClosingAt(nodes: readonly PhrasingContent[], index: number): number {
  const node = nodes[index];
  if (node?.type !== 'html' || !KEY_OPENING.test(node.value)) return -1;
  for (let next = index + 1; next < nodes.length; next++) {
    const sibling = nodes[next]!;
    if (sibling.type === 'html') return KEY_CLOSING.test(sibling.value) ? next : -1;
  }
  return -1;
}

/** Neighbouring texts as one: micromark splits text where a mark could have started. */
function joinedTexts(inlines: MarkdownInline[]): MarkdownInline[] {
  const joined: MarkdownInline[] = [];
  for (const inline of inlines) {
    const last = joined.at(-1);
    if (inline.kind === 'text' && last?.kind === 'text') joined[joined.length - 1] = { kind: 'text', text: last.text + inline.text };
    else joined.push(inline);
  }
  return joined;
}

function textOf(node: Nodes): string {
  if ('value' in node) return String(node.value);
  return 'children' in node ? (node as Parent).children.map((child) => textOf(child as Nodes)).join('') : '';
}
