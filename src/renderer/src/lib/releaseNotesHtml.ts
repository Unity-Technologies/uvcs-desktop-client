import type { MarkdownBlock, MarkdownInline, MarkdownList, MarkdownListItem } from './markdown';

/**
 * Reads release notes as GitHub renders them (HTML, from the releases feed) into the tree `MarkdownBlocks` renders, so
 * no HTML from the feed ever reaches the page. It keeps what release notes use (headings, paragraphs, lists, quotes,
 * code, emphasis and web links) and reads anything else as its text: images, scripts and styles are left out, and each
 * row of a table is a paragraph.
 */
export function releaseNotesFromHtml(html: string): MarkdownBlock[] {
  return blocksOf(parseHtml(html));
}

interface HtmlElement {
  tag: string;
  href: string | null;
  children: HtmlNode[];
}

type HtmlNode = HtmlElement | string;

const TOKEN = /<!--[\s\S]*?(?:-->|$)|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|[^<]+|</g;
const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
/** Elements whose content is never text to show, read up to their end. */
const SKIPPED_TAGS = new Set(['script', 'style', 'template', 'svg', 'math']);
const HREF = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/** A forgiving tree of the tags: an end tag closes the nearest open element it names, and one nothing opened is ignored. */
function parseHtml(html: string): HtmlNode[] {
  const root: HtmlElement = { tag: '', href: null, children: [] };
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
      const element: HtmlElement = { tag, href: hrefOf(attributes!), children: [] };
      open.at(-1)!.children.push(element);
      if (!VOID_TAGS.has(tag)) open.push(element);
    }
  }
  return root.children;
}

function hrefOf(attributes: string): string | null {
  const match = attributes.match(HREF);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3]!) : null;
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

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

function isBlock(node: HtmlNode): node is HtmlElement {
  return typeof node !== 'string' && BLOCK_TAGS.has(node.tag);
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
  if (tag === 'blockquote') return withInlines(children, (inlines) => ({ kind: 'quote', children: inlines }));
  if (tag === 'pre') return [{ kind: 'code', text: textOf(children).replace(/\n$/, '') }];
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
  if (tag === 'img') return [];
  if (tag === 'code' || tag === 'kbd' || tag === 'samp') return [{ kind: 'code', text: textOf(children) }];
  if (tag === 'strong' || tag === 'b') return [{ kind: 'strong', children: inlinesOf(children) }];
  if (tag === 'em' || tag === 'i') return [{ kind: 'emphasis', children: inlinesOf(children) }];
  if (tag === 'a' && node.href && /^https?:\/\//i.test(node.href)) return [{ kind: 'link', url: node.href, children: inlinesOf(children) }];
  // A block inside a line (a paragraph in a list item, a cell in a row) is set apart by a space.
  const inlines = children.flatMap(inlinesOfNode);
  return BLOCK_TAGS.has(tag) ? [{ kind: 'text', text: ' ' }, ...inlines, { kind: 'text', text: ' ' }] : inlines;
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
    else if (inline.kind === 'text' || inline.kind === 'code' || inline.children.length > 0) result.push(inline);
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
