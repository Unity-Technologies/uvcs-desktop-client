import type { MarkdownBlock, MarkdownInline, MarkdownList, MarkdownListItem, TableAlignment } from './markdown';

/**
 * Reads release notes as GitHub renders them (HTML, from the releases feed) into the tree `MarkdownBlocks` renders, so
 * no HTML from the feed ever reaches the page. It keeps what release notes use (headings, paragraphs, lists, quotes,
 * code, tables, emphasis, web links and web images) and reads anything else as its text: scripts and styles are left
 * out, and so are images from any other address.
 */
export function releaseNotesFromHtml(html: string): MarkdownBlock[] {
  return blocksOf(parseHtml(html));
}

/** A part of the notes that a level-2 or level-3 heading opens (`releaseNotesOutline`); the notes before any have none. */
export interface ReleaseNotesPart {
  heading: { level: 2 | 3; children: MarkdownInline[] } | null;
  blocks: MarkdownBlock[];
}

/**
 * The notes cut at their level-2 and level-3 headings, the outline release notes are written in (a group, then each
 * note in it), everything between two of them read as blocks: smaller headings stay inside their part. The HTML is
 * cut, not the blocks, because `MarkdownBlock` reads h3 to h6 as one level.
 */
export function releaseNotesOutline(html: string): ReleaseNotesPart[] {
  const parts: ReleaseNotesPart[] = [];
  let heading: ReleaseNotesPart['heading'] = null;
  let run: HtmlNode[] = [];
  const endPart = (): void => {
    const blocks = blocksOf(run);
    if (heading || blocks.length > 0) parts.push({ heading, blocks });
    run = [];
  };

  for (const node of parseHtml(html)) {
    const outlineHeading = outlineHeadingOf(node);
    if (!outlineHeading) {
      run.push(node);
      continue;
    }
    endPart();
    heading = { level: outlineHeading.tag === 'h2' ? 2 : 3, children: inlinesOf(outlineHeading.children) };
  }
  endPart();
  return parts;
}

/** An h2 or h3, alone or in the box GitHub's pages put a heading and its anchor in (`<div class="markdown-heading">`). */
function outlineHeadingOf(node: HtmlNode): HtmlElement | null {
  if (typeof node === 'string') return null;
  if (node.tag === 'h2' || node.tag === 'h3') return node;
  if (node.tag !== 'div' || !/\bmarkdown-heading\b/.test(node.attributes.class ?? '')) return null;
  const heading = node.children.find((child): child is HtmlElement => typeof child !== 'string' && /^h[1-6]$/.test(child.tag));
  return heading?.tag === 'h2' || heading?.tag === 'h3' ? heading : null;
}

interface HtmlElement {
  tag: string;
  /** The attributes the notes are read with (`READ_ATTRIBUTES`); any other is dropped as it's read. */
  attributes: Partial<Record<ReadAttribute, string>>;
  children: HtmlNode[];
}

type HtmlNode = HtmlElement | string;

const TOKEN = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Elements whose content is never text to show, read up to their end. */
const SKIPPED_TAGS = new Set(['script', 'style', 'template', 'svg', 'math']);
const READ_ATTRIBUTES = ['href', 'src', 'alt', 'align', 'style', 'class'] as const;
type ReadAttribute = (typeof READ_ATTRIBUTES)[number];
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const WEB_ADDRESS = /^https?:\/\//i;

/** A forgiving tree of the tags: an end tag closes the nearest open element it names, and one nothing opened is ignored. */
function parseHtml(html: string): HtmlNode[] {
  const root: HtmlElement = { tag: '', attributes: {}, children: [] };
  const open: HtmlElement[] = [root];
  let skipping: string | null = null;

  for (const [token, closing, rawTag, attributes] of html.matchAll(TOKEN)) {
    const tag = rawTag?.toLowerCase();
    if (skipping) {
      if (closing && tag === skipping) skipping = null;
    } else if (token.startsWith('<!--')) {
      continue;
    } else if (tag === undefined) {
      open.at(-1)!.children.push(decodeEntities(token));
    } else if (closing) {
      const index = open.findLastIndex((element) => element.tag === tag);
      if (index > 0) open.length = index;
    } else if (SKIPPED_TAGS.has(tag)) {
      if (!attributes!.trimEnd().endsWith('/')) skipping = tag;
    } else {
      const element: HtmlElement = { tag, attributes: attributesOf(attributes!), children: [] };
      open.at(-1)!.children.push(element);
      if (!VOID_TAGS.has(tag)) open.push(element);
    }
  }
  return root.children;
}

function attributesOf(source: string): HtmlElement['attributes'] {
  const attributes: HtmlElement['attributes'] = {};
  for (const [, rawName, ...values] of source.matchAll(ATTRIBUTE)) {
    const name = rawName!.toLowerCase();
    if (isReadAttribute(name) && !(name in attributes)) attributes[name] = decodeEntities(values.find((value) => value !== undefined) ?? '');
  }
  return attributes;
}

function isReadAttribute(name: string): name is ReadAttribute {
  return (READ_ATTRIBUTES as readonly string[]).includes(name);
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name: string) => {
    if (name[0] !== '#') return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
    const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

const HEADINGS: Record<string, 1 | 2 | 3> = { h1: 1, h2: 2, h3: 3, h4: 3, h5: 3, h6: 3 };
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'dd', 'details', 'div', 'dl', 'dt', 'figcaption', 'figure', 'footer',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'summary',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
]);

/** A block element, or an element of GitHub's own around one (`<markdown-accessiblity-table>` around a table). */
function isBlock(node: HtmlNode): node is HtmlElement {
  if (typeof node === 'string') return false;
  return BLOCK_TAGS.has(node.tag) || (node.tag.includes('-') && node.children.some(isBlock));
}

/** The blocks of a run of nodes: text and inline elements between blocks read as one paragraph. */
function blocksOf(nodes: HtmlNode[]): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let run: HtmlNode[] = [];
  const endParagraph = (): void => {
    const children = inlinesOf(run);
    if (children.length > 0) blocks.push({ kind: 'paragraph', children });
    run = [];
  };

  for (const node of nodes) {
    if (!isBlock(node)) {
      run.push(node);
      continue;
    }
    endParagraph();
    blocks.push(...blocksOfElement(node));
  }
  endParagraph();
  return blocks;
}

function blocksOfElement(element: HtmlElement): MarkdownBlock[] {
  const { tag, children } = element;
  const heading = HEADINGS[tag];
  if (heading) return withInlines(children, (inlines) => ({ kind: 'heading', level: heading, children: inlines }));
  if (tag === 'p' || tag === 'tr') return withInlines(children, (inlines) => ({ kind: 'paragraph', children: inlines }));
  if (tag === 'blockquote') return withInlines(children, (inlines) => ({ kind: 'quote', children: [{ kind: 'paragraph', children: inlines }] }));
  if (tag === 'pre') return [{ kind: 'code', text: textOf(children).replace(/\n$/, '') }];
  if (tag === 'table') {
    const table = tableOf(element);
    return table ? [table] : [];
  }
  if (tag === 'ul' || tag === 'ol') {
    const list = listOf(element);
    return list ? [list] : [];
  }
  if (tag === 'hr') return [];
  return blocksOf(children);
}

function withInlines(nodes: HtmlNode[], block: (inlines: MarkdownInline[]) => MarkdownBlock): MarkdownBlock[] {
  const inlines = inlinesOf(nodes);
  return inlines.length > 0 ? [block(inlines)] : [];
}

type MarkdownTable = Extract<MarkdownBlock, { kind: 'table' }>;

/** A table: its head's row is its header, or its first row when it has no head (which GitHub never writes). */
function tableOf(table: HtmlElement): MarkdownTable | null {
  const rows = rowsOf(table);
  const headRow = (rows.find((row) => row.inHead) ?? rows[0])?.row;
  if (!headRow) return null;
  const header = cellsOf(headRow);
  return {
    kind: 'table',
    align: header.map((cell) => cell.align),
    header: header.map((cell) => cell.inlines),
    rows: rows.filter(({ row }) => row !== headRow).map(({ row }) => cellsOf(row).map((cell) => cell.inlines)),
  };
}

/** A table's rows, in its head, body and foot or right under it, and whether each is in its head. */
function rowsOf(table: HtmlElement): { row: HtmlElement; inHead: boolean }[] {
  const isRow = (node: HtmlNode): node is HtmlElement => typeof node !== 'string' && node.tag === 'tr';
  return table.children.flatMap((node) => {
    if (typeof node === 'string') return [];
    if (node.tag === 'tr') return [{ row: node, inHead: false }];
    if (!['thead', 'tbody', 'tfoot'].includes(node.tag)) return [];
    return node.children.filter(isRow).map((row) => ({ row, inHead: node.tag === 'thead' }));
  });
}

function cellsOf(row: HtmlElement): { inlines: MarkdownInline[]; align: TableAlignment }[] {
  return row.children.flatMap((cell) =>
    typeof cell !== 'string' && (cell.tag === 'th' || cell.tag === 'td') ? [{ inlines: inlinesOf(cell.children), align: alignmentOf(cell) }] : [],
  );
}

/** GitHub writes a column's alignment as `align`; other writers put it in the cell's `style`. */
function alignmentOf(cell: HtmlElement): TableAlignment {
  const align = (cell.attributes.align ?? cell.attributes.style?.match(/text-align\s*:\s*(\w+)/i)?.[1] ?? '').toLowerCase();
  return align === 'left' || align === 'center' || align === 'right' ? align : null;
}

function listOf(element: HtmlElement): MarkdownList | null {
  const items = element.children.flatMap((node) => (typeof node !== 'string' && node.tag === 'li' ? listItemOf(node) : []));
  return items.length > 0 ? { kind: 'list', ordered: element.tag === 'ol', items } : null;
}

/** A list item's line, and the lists nested in it as one list under it (an item holds one in what GitHub renders). */
function listItemOf(item: HtmlElement): MarkdownListItem[] {
  const isList = (node: HtmlNode): node is HtmlElement => typeof node !== 'string' && (node.tag === 'ul' || node.tag === 'ol');
  const nested = item.children.filter(isList).map(listOf).filter((list) => list !== null);
  const children = inlinesOf(item.children.filter((node) => !isList(node)));
  if (children.length === 0 && nested.length === 0) return [];
  const sublist = nested.length > 0 ? { ...nested[0]!, items: nested.flatMap((list) => list.items) } : undefined;
  return [sublist ? { children, sublist } : { children }];
}

/** The nodes as one line of inline marks, the white space collapsed as a browser would. */
function inlinesOf(nodes: HtmlNode[]): MarkdownInline[] {
  return trimmed(merged(nodes.flatMap(inlinesOfNode)));
}

function inlinesOfNode(node: HtmlNode): MarkdownInline[] {
  if (typeof node === 'string') return [{ kind: 'text', text: node.replace(/[ \t\r\n\f]+/g, ' ') }];
  const { tag, children } = node;
  if (tag === 'br') return [{ kind: 'text', text: ' ' }];
  if (tag === 'img') return imageOf(node);
  if (tag === 'code' || tag === 'kbd' || tag === 'samp') return [{ kind: 'code', text: textOf(children) }];
  if (tag === 'strong' || tag === 'b') return [{ kind: 'strong', children: inlinesOf(children) }];
  if (tag === 'em' || tag === 'i') return [{ kind: 'emphasis', children: inlinesOf(children) }];
  if (tag === 'a') return linkOf(node);
  // A block inside a line (a paragraph in a list item, a cell in a row) is set apart by a space.
  const inlines = children.flatMap(inlinesOfNode);
  return BLOCK_TAGS.has(tag) ? [{ kind: 'text', text: ' ' }, ...inlines, { kind: 'text', text: ' ' }] : inlines;
}

/** A picture from the web; one from any other address (`data:`, a file, a page's own path) is left out. */
function imageOf(image: HtmlElement): MarkdownInline[] {
  const url = image.attributes.src?.trim() ?? '';
  return WEB_ADDRESS.test(url) ? [{ kind: 'image', url, alt: image.attributes.alt ?? '' }] : [];
}

/**
 * A web link, or its text when it goes anywhere else. GitHub wraps each picture in a link to the picture itself: a
 * link holding only pictures is those pictures, which open by themselves.
 */
function linkOf(link: HtmlElement): MarkdownInline[] {
  const children = inlinesOf(link.children);
  const url = link.attributes.href ?? '';
  if (!WEB_ADDRESS.test(url) || children.every((inline) => inline.kind === 'image')) return children;
  return [{ kind: 'link', url, children }];
}

function textOf(nodes: HtmlNode[]): string {
  return nodes.map((node) => (typeof node === 'string' ? node : node.tag === 'br' ? '\n' : textOf(node.children))).join('');
}

/** Joins neighbouring text, collapsing the spaces where they meet, and drops marks left with nothing in them. */
function merged(inlines: MarkdownInline[]): MarkdownInline[] {
  const result: MarkdownInline[] = [];
  for (const inline of inlines) {
    const previous = result.at(-1);
    if (inline.kind === 'text' && previous?.kind === 'text') previous.text = (previous.text + inline.text).replace(/ {2,}/g, ' ');
    else if (inline.kind === 'text' || !('children' in inline) || inline.children.length > 0) result.push(inline);
  }
  return result;
}

/** Without the spaces at the start and end of the line, as a browser shows it. */
function trimmed(inlines: MarkdownInline[]): MarkdownInline[] {
  const first = inlines[0];
  if (first?.kind === 'text') first.text = first.text.trimStart();
  const last = inlines.at(-1);
  if (last?.kind === 'text') last.text = last.text.trimEnd();
  return inlines.filter((inline) => inline.kind !== 'text' || inline.text !== '');
}
