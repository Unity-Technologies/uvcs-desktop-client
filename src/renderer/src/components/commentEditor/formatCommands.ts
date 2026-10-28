import { EditorSelection, type ChangeSpec, type EditorState, type SelectionRange, type StateCommand, type TransactionSpec } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type { SyntaxNode } from '@lezer/common';
import { ownStep } from './ownStep';

/**
 * Formatting without knowing Markdown (docs/features/rich-comments.md, "Writing"): each command writes, or takes away,
 * the Markdown for the selection, so the text stays the comment as stored. The selection bar and the keys run them,
 * and each is one step to undo.
 */
export type FormatCommandId = 'bold' | 'italic' | 'strikethrough' | 'code' | 'link' | 'bullet' | 'task' | 'numbered' | 'quote' | 'codeBlock';

/** The marks each inline format writes, and the construct the Markdown reader names it by. */
const INLINE: Record<InlineFormat, { mark: string; node: string }> = {
  bold: { mark: '**', node: 'StrongEmphasis' },
  // `*`, not `_`, as GitHub reads `_` inside a word as a letter: `un*do*ne` is italic, `un_do_ne` isn't.
  italic: { mark: '*', node: 'Emphasis' },
  strikethrough: { mark: '~~', node: 'Strikethrough' },
  code: { mark: '`', node: 'InlineCode' },
};

type InlineFormat = 'bold' | 'italic' | 'strikethrough' | 'code';
type LineFormat = 'bullet' | 'task' | 'numbered' | 'quote';

/** Each line format's marker, for the `index`th line written (a numbered list counts from one), and how it reads. */
const LINE_PREFIX: Record<LineFormat, { prefix: (index: number) => string; is: RegExp }> = {
  bullet: { prefix: () => '- ', is: /^(\s*)[-*+] (?!\[[ xX]\] )/ },
  task: { prefix: () => '- [ ] ', is: /^(\s*)[-*+] \[[ xX]\] / },
  numbered: { prefix: (index) => `${index + 1}. `, is: /^(\s*)\d+[.)] / },
  quote: { prefix: () => '> ', is: /^(\s*)> ?/ },
};

/** Any list item's marker, so a list line becomes the other kind instead of gaining a second marker. */
const LIST_MARKER = /^(\s*)(?:[-*+] (?:\[[ xX]\] )?|\d+[.)] )/;

/** An address on its own: what a link takes, and what a link pasted on a selection is made from. */
export const LINK_ADDRESS = /^(?:https?|uvcs):\/\/\S+$/;

/** Where formatting is the text's own: inside code, `**` is two asterisks. */
const CODE = new Set(['InlineCode', 'FencedCode', 'CodeBlock', 'CodeText']);

export const FORMAT_COMMANDS: Record<FormatCommandId, StateCommand> = {
  bold: toggleInline('bold'),
  italic: toggleInline('italic'),
  strikethrough: toggleInline('strikethrough'),
  code: toggleInline('code'),
  link: toggleLink,
  bullet: toggleLinePrefix('bullet'),
  task: toggleLinePrefix('task'),
  numbered: toggleLinePrefix('numbered'),
  quote: toggleLinePrefix('quote'),
  codeBlock: toggleCodeBlock,
};

/** Bold, italic, strikethrough or code on the selection; off again when the selection or the caret is in one. */
function toggleInline(format: InlineFormat): StateCommand {
  const { mark, node } = INLINE[format];
  return ({ state, dispatch }) => {
    const main = state.selection.main;
    const around = enclosing(state, main, node);
    if (!around && isInCode(state, main.from)) return false;
    if (around) {
      dispatch(state.update(unwrap(state, around), { scrollIntoView: true, userEvent: 'input.format', annotations: ownStep }));
      return true;
    }
    dispatch(state.update(state.changeByRange((range) => wrap(state, range, mark)), { scrollIntoView: true, userEvent: 'input.format', annotations: ownStep }));
    return true;
  };
}

/** Takes a construct's marks away, its text and the selection in it staying where they are. */
function unwrap(state: EditorState, construct: SyntaxNode): { changes: ChangeSpec[]; selection: EditorSelection } {
  const open = construct.firstChild!;
  const close = construct.lastChild!;
  const changes = state.changes([
    { from: open.from, to: open.to },
    { from: close.from, to: close.to },
  ]);
  return { changes: [changes], selection: state.selection.map(changes) };
}

/**
 * The marks around a range's text, line by line (`**` can't span a paragraph), leaving the spaces at its edges out:
 * `** bold**` isn't bold. A caret gets both marks, itself between them, to type the text in.
 */
function wrap(state: EditorState, range: SelectionRange, mark: string): { changes: ChangeSpec[]; range: SelectionRange } {
  if (range.empty) return { changes: [{ from: range.from, insert: mark + mark }], range: EditorSelection.cursor(range.from + mark.length) };
  const changes: ChangeSpec[] = [];
  for (let line = state.doc.lineAt(range.from); ; line = state.doc.line(line.number + 1)) {
    const from = Math.max(range.from, line.from);
    const to = Math.min(range.to, line.to);
    const text = state.sliceDoc(from, to);
    const start = from + (text.length - text.trimStart().length);
    const end = to - (text.length - text.trimEnd().length);
    if (end > start) changes.push({ from: start, insert: mark }, { from: end, insert: mark });
    if (line.to >= range.to) break;
  }
  const set = state.changes(changes);
  // The text stays selected, inside its marks.
  return { changes, range: EditorSelection.range(set.mapPos(range.anchor, range.anchor <= range.head ? 1 : -1), set.mapPos(range.head, range.anchor <= range.head ? -1 : 1)) };
}

/** A list, a task list, a numbered list or a quote on the selected lines; off again when every line already is one. */
function toggleLinePrefix(format: LineFormat): StateCommand {
  const { prefix, is } = LINE_PREFIX[format];
  return ({ state, dispatch }) => {
    const main = state.selection.main;
    if (isInCode(state, main.from)) return false;
    const lines = selectedLines(state, main);
    // Blank lines in a selection of several stay blank: an empty item or quote line would split nothing.
    const written = lines.length > 1 ? lines.filter((line) => line.text.trim()) : lines;
    const every = written.every((line) => is.test(line.text));
    const changes = state.changes(
      written.map((line, index) => {
        if (every) {
          const match = is.exec(line.text)!;
          return { from: line.from + match[1]!.length, to: line.from + match[0].length };
        }
        const list = format === 'quote' ? null : LIST_MARKER.exec(line.text);
        if (list) return { from: line.from + list[1]!.length, to: line.from + list[0].length, insert: prefix(index) };
        const indent = /^\s*/.exec(line.text)![0].length;
        return { from: line.from + indent, insert: prefix(index) };
      }),
    );
    // The caret moves along with its text, after a marker written where it was.
    const selection = EditorSelection.create(state.selection.ranges.map((range) => EditorSelection.range(changes.mapPos(range.anchor, 1), changes.mapPos(range.head, 1))));
    dispatch(state.update({ changes, selection, scrollIntoView: true, userEvent: 'input.format', annotations: ownStep }));
    return true;
  };
}

/** The selected lines as a code block, or an empty one to type in; out of the code block again from inside one. */
function toggleCodeBlock({ state, dispatch }: Parameters<StateCommand>[0]): boolean {
  const main = state.selection.main;
  const block = enclosingFrom(state, main.head, 'FencedCode');
  if (block) {
    dispatch(state.update({ changes: fenceLinesOf(state, block), scrollIntoView: true, userEvent: 'input.format', annotations: ownStep }));
    return true;
  }
  const first = state.doc.lineAt(main.from);
  const last = state.doc.lineAt(main.to);
  if (main.empty && !first.text.trim()) {
    dispatch(state.update({ changes: { from: first.from, to: first.to, insert: '```\n\n```' }, selection: { anchor: first.from + 4 }, scrollIntoView: true, userEvent: 'input.format', annotations: ownStep }));
    return true;
  }
  const changes = state.changes([
    { from: first.from, insert: '```\n' },
    { from: last.to, insert: '\n```' },
  ]);
  dispatch(state.update({ changes, selection: { anchor: first.from + 4, head: changes.mapPos(last.to, -1) }, scrollIntoView: true, userEvent: 'input.format', annotations: ownStep }));
  return true;
}

/** A code block's fence lines, whole, to take away: the code stays as it was. */
function fenceLinesOf(state: EditorState, block: SyntaxNode): ChangeSpec[] {
  const marks = block.getChildren('CodeMark');
  return marks.map((mark) => {
    const line = state.doc.lineAt(mark.from);
    // The line end goes with the fence: the line after an opening one, the one before a closing one.
    return mark === marks[0] ? { from: line.from, to: Math.min(line.to + 1, state.doc.length) } : { from: Math.max(line.from - 1, 0), to: line.to };
  });
}

/**
 * A link on the selection, as GitHub's ⌘K: the selected text inside `[…]` and `url` selected to paste the address
 * over; a selected address becomes the link's address, the caret where its text goes. Inside a link, the link goes
 * and its text stays.
 */
function toggleLink({ state, dispatch }: Parameters<StateCommand>[0]): boolean {
  const main = state.selection.main;
  if (isInCode(state, main.from)) return false;
  const link = enclosing(state, main, 'Link');
  if (link) {
    const textEnd = link.getChildren('LinkMark')[1]?.from ?? link.to;
    const changes = state.changes([
      { from: link.from, to: link.from + 1 },
      { from: textEnd, to: link.to },
    ]);
    dispatch(state.update({ changes, selection: state.selection.map(changes), scrollIntoView: true, userEvent: 'input.format', annotations: ownStep }));
    return true;
  }
  const selected = state.sliceDoc(main.from, main.to);
  if (LINK_ADDRESS.test(selected)) {
    dispatch(state.update({ changes: { from: main.from, to: main.to, insert: `[](${selected})` }, selection: { anchor: main.from + 1 }, scrollIntoView: true, userEvent: 'input.format', annotations: ownStep }));
    return true;
  }
  const address = main.from + selected.length + 3;
  dispatch(
    state.update({
      changes: { from: main.from, to: main.to, insert: `[${selected}](url)` },
      selection: { anchor: address, head: address + 3 },
      scrollIntoView: true,
      userEvent: 'input.format',
      annotations: ownStep,
    }),
  );
  return true;
}

/**
 * Enter after an opening fence (```` ```csharp ````) adds the closing one, the caret on the line between, as Slack
 * opens a code block. Only for a fence still open: Enter after a closing fence, or inside a block, is a new line.
 */
export const closeCodeFence: StateCommand = ({ state, dispatch }) => {
  const main = state.selection.main;
  const line = state.doc.lineAt(main.head);
  if (!main.empty || main.head !== line.to || !/^\s*```[^`\s]*\s*$/.test(line.text)) return false;
  const block = enclosingFrom(state, line.from, 'FencedCode', 1);
  if (!block || block.from !== line.from + (line.text.length - line.text.trimStart().length) || block.getChildren('CodeMark').length > 1) return false;
  dispatch(state.update({ changes: { from: line.to, insert: '\n\n```' }, selection: { anchor: line.to + 1 }, scrollIntoView: true, userEvent: 'input' }));
  return true;
};

/** A click on a task's box: `[ ]` checked as `[x]`, or the other way round. `box` is where its `[` is. */
export function toggleTask(state: EditorState, box: number): TransactionSpec {
  const checked = /x/i.test(state.sliceDoc(box + 1, box + 2));
  return { changes: { from: box + 1, to: box + 2, insert: checked ? ' ' : 'x' }, userEvent: 'input.toggle', annotations: ownStep };
}

/**
 * What a paste of `text` on the selection does when it's an address and text is selected: links the text to it, as
 * GitHub and Slack do. Null for anything else, which pastes as it would.
 */
export function linkFromPaste(state: EditorState, text: string): { from: number; to: number; insert: string } | null {
  const main = state.selection.main;
  const address = text.trim();
  const selected = state.sliceDoc(main.from, main.to);
  if (main.empty || !LINK_ADDRESS.test(address) || selected.includes('\n') || LINK_ADDRESS.test(selected) || isInCode(state, main.from)) return null;
  return { from: main.from, to: main.to, insert: `[${selected}](${address})` };
}

/** The formats the selection is in: what the selection bar shows as on. */
export function activeFormats(state: EditorState): Set<FormatCommandId> {
  const main = state.selection.main;
  const active = new Set<FormatCommandId>();
  for (const [format, { node }] of Object.entries(INLINE) as [InlineFormat, { node: string }][]) if (enclosing(state, main, node)) active.add(format);
  if (enclosing(state, main, 'Link')) active.add('link');
  if (enclosingFrom(state, main.head, 'FencedCode')) active.add('codeBlock');
  const lines = selectedLines(state, main).filter((line) => line.text.trim());
  for (const format of ['bullet', 'task', 'numbered', 'quote'] as const) {
    if (lines.length > 0 && lines.every((line) => LINE_PREFIX[format].is.test(line.text))) active.add(format);
  }
  return active;
}

/** Whether `pos` is in code, where Markdown's marks are the text's own. */
export function isInCode(state: EditorState, pos: number): boolean {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
    if (CODE.has(node.name) && node.from < pos) return true;
  }
  return false;
}

/** The `name` construct holding the whole range, its marks included or not. */
function enclosing(state: EditorState, range: SelectionRange, name: string): SyntaxNode | null {
  const node = enclosingFrom(state, range.from, name, 1) ?? enclosingFrom(state, range.from, name, -1);
  return node && node.from <= range.from && node.to >= range.to ? node : null;
}

function enclosingFrom(state: EditorState, pos: number, name: string, side: -1 | 1 = -1): SyntaxNode | null {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); node; node = node.parent) if (node.name === name) return node;
  return null;
}

function selectedLines(state: EditorState, range: SelectionRange) {
  const lines = [];
  for (let number = state.doc.lineAt(range.from).number; number <= state.doc.lineAt(range.to).number; number++) lines.push(state.doc.line(number));
  return lines;
}
