import type { EditorState } from '@codemirror/state';

/** A block the editor draws in place of its source lines (a table: `tableModel`). */
export interface DrawnBlock {
  from: number;
  to: number;
}

/**
 * Where ↓ (`direction` 1) or ↑ (-1) puts the caret at `head` when the line it goes to is a drawn block: its first
 * line going down, its last going up, at the caret's column as far as that line goes. The editor moves by what it
 * shows, so it would step over the whole block; landing in its source reveals it. Null leaves the move to the editor.
 */
export function verticalMoveInto(state: EditorState, blocks: readonly DrawnBlock[], head: number, direction: 1 | -1): number | null {
  const line = state.doc.lineAt(head);
  const column = head - line.from;
  if (direction === 1) {
    if (line.number === state.doc.lines) return null;
    const next = state.doc.line(line.number + 1);
    if (!blocks.some((block) => block.from === next.from)) return null;
    return next.from + Math.min(column, next.length);
  }
  if (line.number === 1) return null;
  const previous = state.doc.line(line.number - 1);
  if (!blocks.some((block) => block.to === previous.to)) return null;
  return previous.from + Math.min(column, previous.length);
}
