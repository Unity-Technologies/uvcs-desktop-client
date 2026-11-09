import { syntaxTree } from '@codemirror/language';
import type { ChangeSpec, EditorState, Line, StateCommand } from '@codemirror/state';
import { ownStep } from './ownStep';

/** A list item's marker: `- `, `* `, `+ `, `1. `, `2) ` (a task's box is the item's text, which it keeps). */
const LIST_MARKER = /^(\s*)([-*+] |\d+[.)] )/;

/** The indent a code block with none of its own takes: GitHub's and most editors' default. */
const CODE_INDENT = '    ';

/**
 * Tab in focus mode (docs/features/rich-comments.md, "Writing"), where the text is all there is on screen: it nests a
 * list item under the one above by its marker's width, as GitHub and Obsidian do, and indents a code block's line by
 * the block's own indent (a tab, or the spaces its first indented line has), four spaces in a block with none. A
 * paragraph's line is left alone: four spaces would turn it into a code block, which no one pressing Tab means. Each
 * line of a selection over several takes its own. Always handled, so Tab never leaves the larger editor.
 */
export const indentLines: StateCommand = ({ state, dispatch }) => {
  const changes = linesOf(state).flatMap((line): ChangeSpec[] => {
    const unit = indentOf(state, line);
    return unit ? [{ from: line.from, insert: unit }] : [];
  });
  if (changes.length === 0) return true;
  // The caret moves with its text, after the indent written at a line's start.
  const set = state.changes(changes);
  dispatch(state.update({ changes: set, selection: state.selection.map(set, 1), scrollIntoView: true, userEvent: 'input.indent', annotations: ownStep }));
  return true;
};

/** ⇧Tab in focus mode: takes back what `indentLines` adds, as far as the line's leading space goes. */
export const outdentLines: StateCommand = ({ state, dispatch }) => {
  const changes = linesOf(state).flatMap((line): ChangeSpec[] => {
    const unit = indentOf(state, line);
    const leading = /^[ \t]*/.exec(line.text)![0];
    if (!unit || !leading) return [];
    const taken = leading.startsWith('\t') ? 1 : Math.min(leading.length, unit === '\t' ? 4 : unit.length);
    return [{ from: line.from, to: line.from + taken }];
  });
  if (changes.length > 0) dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'delete.dedent', annotations: ownStep }));
  return true;
};

function linesOf(state: EditorState): Line[] {
  const lines = new Map<number, Line>();
  for (const range of state.selection.ranges) {
    for (let number = state.doc.lineAt(range.from).number; number <= state.doc.lineAt(range.to).number; number++) lines.set(number, state.doc.line(number));
  }
  return [...lines.values()];
}

/** What Tab adds at a line's start: its list marker's width, its code block's indent, or nothing. */
function indentOf(state: EditorState, line: Line): string | null {
  const block = codeBlockAround(state, line);
  if (block) return block;
  const item = LIST_MARKER.exec(line.text);
  return item ? ' '.repeat(item[2]!.length) : null;
}

/** The indent of the code block a line is code of (its fences aren't), or null outside one. */
function codeBlockAround(state: EditorState, line: Line): string | null {
  for (let node = syntaxTree(state).resolveInner(line.from, 1); node.parent; node = node.parent) {
    if (node.name !== 'FencedCode') continue;
    const first = state.doc.lineAt(node.from);
    const last = state.doc.lineAt(node.to);
    if (line.number === first.number || (line.number === last.number && /^\s*(`{3,}|~{3,})\s*$/.test(line.text))) return null;
    for (let number = first.number + 1; number < last.number; number++) {
      const leading = /^[ \t]+/.exec(state.doc.line(number).text)?.[0];
      if (leading) return leading.startsWith('\t') ? '\t' : leading;
    }
    return CODE_INDENT;
  }
  return null;
}
