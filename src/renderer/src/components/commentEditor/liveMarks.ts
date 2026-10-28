import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common';
import { findReferences, type CommentReference } from '../../lib/comments/commentReferences';

/**
 * What the live editor draws over a comment's Markdown text (docs/features/rich-comments.md, "Writing"): the text
 * stays the comment as stored, and these say which of it shows as typed and which as it reads.
 */
export type LiveMark =
  /** Markdown's own marks (`**`, `` ` ``, `# `, a link's address) that the construct around the caret alone shows. */
  | { kind: 'hidden'; from: number; to: number }
  /** A reference to an object, a person or an emoji, drawn as the comment's chip while the caret is away from it. */
  | { kind: 'reference'; from: number; to: number; reference: CommentReference; source: string }
  /**
   * A reference the caret reaches (an arrow, a click selecting it, typing it), shown as its text to edit, as a mark
   * shows around the caret.
   */
  | { kind: 'typedReference'; from: number; to: number }
  /** An image, drawn as the comment's chip with its description. */
  | { kind: 'image'; from: number; to: number; alt: string; url: string; source: string }
  /** A list's `-`, drawn as a bullet. */
  | { kind: 'bullet'; from: number; to: number }
  /** A task's box, `[ ]` or `[x]`, and the list's `- ` before it: a checkbox a click toggles. `box` is where `[` is. */
  | { kind: 'task'; from: number; to: number; checked: boolean; box: number }
  /** A link's text, drawn as a link. */
  | { kind: 'link'; from: number; to: number }
  /** A key between `<kbd>` and `</kbd>`, drawn as its keycap, as the shown comment draws it. */
  | { kind: 'key'; from: number; to: number }
  /** A widget a selection covers (a chip, an image, a task's box, a bullet), drawn as selected. */
  | { kind: 'selected'; from: number; to: number }
  /** A code block's fences and language, dimmed so the code stands out. */
  | { kind: 'fence'; from: number; to: number }
  /** A line inside a block: a quote's, or a code block's (its first and last too, for the block's corners). */
  | { kind: 'line'; at: number; block: 'quote' | 'code' | 'codeFirst' | 'codeLast' };

export interface LiveMarksOptions {
  /**
   * Whether the selection reveals what it's in. A field without the focus shows its comment as it reads, its caret
   * where it was.
   */
  revealsSelection: boolean;
}

/** Where references can't be: code, links and their addresses, images, raw HTML (as the shown comment reads them). */
const NO_REFERENCES = new Set(['InlineCode', 'FencedCode', 'CodeBlock', 'URL', 'Link', 'Image', 'Autolink', 'HTMLTag', 'HTMLBlock', 'Comment', 'CommentBlock']);

/** A bare address the Markdown reader links: a web page's, where `?branch=br:/main` stays in the address. */
const WEB_ADDRESS = /^(?:[a-z][a-z0-9+.-]*:\/\/|www\.)/i;

/**
 * The marks over `[from, to]` of the text (the editor's visible ranges; the whole text by default), in order. A table
 * the selection isn't in is left alone here: `tableModel` draws it whole.
 */
export function liveMarksOf(state: EditorState, options: LiveMarksOptions, ranges: readonly { from: number; to: number }[] = [{ from: 0, to: state.doc.length }]): LiveMark[] {
  const marks: LiveMark[] = [];
  const reveals = (from: number, to: number): boolean => options.revealsSelection && selectionReveals(state, from, to);
  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === 'Table' && !reveals(node.from, node.to)) return false;
        return markNode(state, node, reveals, marks);
      },
    });
    for (const found of referencesIn(state, from, to, options)) {
      marks.push(
        options.revealsSelection && selectionReveals(state, found.from, found.to)
          ? { kind: 'typedReference', from: found.from, to: found.to }
          : { kind: 'reference', ...found },
      );
    }
  }
  if (options.revealsSelection) marks.push(...selectedWidgets(state, marks));
  return marks.sort((a, b) => startOf(a) - startOf(b));
}

/** Adds the marks a node draws; false when its children draw nothing more (a code block, an image). */
function markNode(state: EditorState, node: SyntaxNodeRef, reveals: (from: number, to: number) => boolean, marks: LiveMark[]): false | void {
  const parent = node.node.parent;
  switch (node.name) {
    case 'Blockquote':
      for (const at of lineStarts(state, node.from, node.to)) marks.push({ kind: 'line', at, block: 'quote' });
      return;
    case 'FencedCode':
      markCodeBlock(state, node.node, marks);
      return false;
    case 'Image':
      markImage(state, node.node, reveals, marks);
      return false;
    case 'TaskMarker':
      markTask(state, node, reveals, marks);
      return;
    case 'ListMark':
      if (parent?.parent?.name === 'BulletList') markBullet(node, reveals, marks);
      return;
    case 'HeaderMark':
      // An underlined heading's `===` stays: only `#`s are a heading's mark before its text.
      if (parent?.name.startsWith('ATXHeading') && !reveals(parent.from, parent.to)) marks.push({ kind: 'hidden', from: node.from, to: withSpaceAfter(state, node.to) });
      return;
    case 'QuoteMark':
      if (!reveals(node.from, withSpaceAfter(state, node.to))) marks.push({ kind: 'hidden', from: node.from, to: withSpaceAfter(state, node.to) });
      return;
    case 'CodeMark':
      if (parent?.name === 'InlineCode' && !reveals(parent.from, parent.to)) marks.push({ kind: 'hidden', from: node.from, to: node.to });
      return;
    case 'EmphasisMark':
    case 'StrikethroughMark':
      // The construct is the mark's parent: Emphasis, StrongEmphasis or Strikethrough.
      if (parent && !reveals(parent.from, parent.to)) marks.push({ kind: 'hidden', from: node.from, to: node.to });
      return;
    case 'Link':
      markLink(node.node, reveals, marks);
      return;
    case 'HTMLTag':
      markKey(state, node.node, reveals, marks);
      return;
  }
}

function markCodeBlock(state: EditorState, block: SyntaxNode, marks: LiveMark[]): void {
  const starts = lineStarts(state, block.from, block.to);
  starts.forEach((at, index) => marks.push({ kind: 'line', at, block: index === 0 ? 'codeFirst' : index === starts.length - 1 ? 'codeLast' : 'code' }));
  for (let child = block.firstChild; child; child = child.nextSibling) {
    if (child.name === 'CodeMark' || child.name === 'CodeInfo') marks.push({ kind: 'fence', from: child.from, to: child.to });
  }
}

/** `![alt](https://…)` reads as its chip, as the shown comment draws it; an image from elsewhere stays as written. */
function markImage(state: EditorState, image: SyntaxNode, reveals: (from: number, to: number) => boolean, marks: LiveMark[]): void {
  if (reveals(image.from, image.to)) return;
  const linkMarks = image.getChildren('LinkMark');
  const url = image.getChild('URL');
  const closing = linkMarks[1];
  if (!url || !closing) return;
  const address = state.sliceDoc(url.from, url.to);
  if (!/^https?:\/\//i.test(address)) return;
  marks.push({ kind: 'image', from: image.from, to: image.to, alt: state.sliceDoc(image.from + 2, closing.from), url: address, source: state.sliceDoc(image.from, image.to) });
}

/** The box replaces the list's `- ` too, the box being the item's bullet, unless the caret is at the `- `. */
function markTask(state: EditorState, marker: SyntaxNodeRef, reveals: (from: number, to: number) => boolean, marks: LiveMark[]): void {
  if (reveals(marker.from, marker.to)) return;
  // The item's own `-`, wherever its line starts (`> - [ ]` in a quote).
  const bulletFrom = marker.node.parent?.parent?.getChild('ListMark')?.from ?? marker.from;
  const from = reveals(bulletFrom, marker.from) ? marker.from : bulletFrom;
  marks.push({ kind: 'task', from, to: marker.to, checked: /x/i.test(state.sliceDoc(marker.from, marker.to)), box: marker.from });
}

/** `- ` draws as a bullet, but not on a task's line, whose box is its bullet. */
function markBullet(mark: SyntaxNodeRef, reveals: (from: number, to: number) => boolean, marks: LiveMark[]): void {
  if (mark.node.parent?.getChild('Task') || reveals(mark.from, mark.to + 1)) return;
  marks.push({ kind: 'bullet', from: mark.from, to: mark.to });
}

/** `[text](address)` reads as its text, drawn as a link; the brackets and the address show around the caret. */
function markLink(link: SyntaxNode, reveals: (from: number, to: number) => boolean, marks: LiveMark[]): void {
  const shows = reveals(link.from, link.to);
  for (let child = link.firstChild; child; child = child.nextSibling) {
    if (!shows && (child.name === 'LinkMark' || child.name === 'URL' || child.name === 'LinkTitle')) marks.push({ kind: 'hidden', from: child.from, to: child.to });
  }
  const textEnd = link.getChildren('LinkMark')[1]?.from ?? link.to;
  // A link with no text yet (`[](url)`, as ⌘K writes it) has nothing to draw as a link.
  if (textEnd > link.from + 1) marks.push({ kind: 'link', from: link.from + 1, to: textEnd });
}

/**
 * `<kbd>Ctrl</kbd>` reads as its keycap, the shown comment's only raw HTML (`parseMarkdown`): the tags hide, unless
 * the caret is in the key. Read from its opening tag, the closing one being a later sibling on its line.
 */
function markKey(state: EditorState, open: SyntaxNode, reveals: (from: number, to: number) => boolean, marks: LiveMark[]): void {
  if (!/^<kbd>$/i.test(state.sliceDoc(open.from, open.to))) return;
  let close = open.nextSibling;
  while (close && !(close.name === 'HTMLTag' && /^<\/kbd>$/i.test(state.sliceDoc(close.from, close.to)))) close = close.nextSibling;
  if (!close || close.from === open.to || state.sliceDoc(open.to, close.from).includes('\n') || reveals(open.from, close.to)) return;
  marks.push({ kind: 'hidden', from: open.from, to: open.to }, { kind: 'key', from: open.to, to: close.from }, { kind: 'hidden', from: close.from, to: close.to });
}

export interface FoundReference {
  from: number;
  to: number;
  reference: CommentReference;
  source: string;
}

/**
 * The references written in `[from, to]`, read line by line as the shown comment reads them (`findReferences`), and
 * never in code, a link, an image, raw HTML, or a table drawn whole.
 */
export function referencesIn(state: EditorState, from: number, to: number, options: LiveMarksOptions): FoundReference[] {
  const excluded = excludedRanges(state, from, to, options);
  const found: FoundReference[] = [];
  for (let line = state.doc.lineAt(from); ; line = state.doc.line(line.number + 1)) {
    for (const reference of findReferences(line.text)) {
      const at = { from: line.from + reference.from, to: line.from + reference.to };
      if (at.from >= from && at.to <= to && !excluded.some(([start, end]) => at.from < end && at.to > start)) {
        found.push({ ...at, reference: reference.reference, source: reference.source });
      }
    }
    if (line.to >= to || line.number === state.doc.lines) break;
  }
  return found;
}

function excludedRanges(state: EditorState, from: number, to: number, options: LiveMarksOptions): [number, number][] {
  const excluded: [number, number][] = [];
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      const drawnTable = node.name === 'Table' && !(options.revealsSelection && selectionReveals(state, node.from, node.to));
      if (!NO_REFERENCES.has(node.name) && !drawnTable) return;
      // A bare email address isn't one: a mention or a spec may hold what reads as one (`@ana@acme.com`).
      if (node.name === 'URL' && !WEB_ADDRESS.test(state.sliceDoc(node.from, node.to))) return;
      excluded.push([node.from, node.to]);
      return false;
    },
  });
  return excluded;
}

/**
 * Whether the selection reveals `[from, to]`: a caret on it or next to it (at a construct's edge, as it's about to type
 * there). A selection reveals only where it started, its anchor: the press or the caret that began it showed that
 * construct already, and what it grows over stays drawn. Revealing what a drag covers would reflow the text under the
 * pointer (a table's source is shorter than the table, an image's much longer), moving where the drag lands, which
 * reveals other text again: the selection would jump and shake.
 */
export function selectionReveals(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => range.anchor >= from && range.anchor <= to);
}

/** Whether a selection, not a caret, covers some of `[from, to]`: a widget drawn there shows as selected. */
export function selectionCovers(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) => !range.empty && range.from < to && range.to > from);
}

/** What draws as a widget in place of its text, which the browser's selection doesn't paint. */
const WIDGET_KINDS = new Set<LiveMark['kind']>(['reference', 'image', 'task', 'bullet']);

function selectedWidgets(state: EditorState, marks: readonly LiveMark[]): LiveMark[] {
  return marks.flatMap((mark) =>
    mark.kind !== 'line' && WIDGET_KINDS.has(mark.kind) && selectionCovers(state, mark.from, mark.to) ? [{ kind: 'selected' as const, from: mark.from, to: mark.to }] : [],
  );
}


function withSpaceAfter(state: EditorState, to: number): number {
  return state.sliceDoc(to, to + 1) === ' ' ? to + 1 : to;
}

function lineStarts(state: EditorState, from: number, to: number): number[] {
  const starts: number[] = [];
  for (let number = state.doc.lineAt(from).number; number <= state.doc.lineAt(to).number; number++) starts.push(state.doc.line(number).from);
  return starts;
}

function startOf(mark: LiveMark): number {
  return mark.kind === 'line' ? mark.at : mark.from;
}
