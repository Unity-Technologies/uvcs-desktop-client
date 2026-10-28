import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { selectionCovers, selectionReveals, type LiveMarksOptions } from './liveMarks';

/** A cell of a table drawn in the editor: its text as written, and where it is, for a click to put the caret in it. */
export interface TableCell {
  text: string;
  from: number;
  to: number;
}

export type ColumnAlign = 'left' | 'center' | 'right' | null;

/**
 * A GitHub table the selection isn't in, which the editor draws as a table (docs/features/rich-comments.md,
 * "Writing"): with the caret in it, it shows as typed. `from` and `to` are the table's text, whole lines.
 */
export interface TableModel {
  from: number;
  to: number;
  /** Whether a selection covers some of it: drawn as selected, as the browser's selection doesn't paint it. */
  selected: boolean;
  align: ColumnAlign[];
  header: TableCell[];
  rows: TableCell[][];
}

/** The tables to draw: every one the selection isn't in (any, in a field without the focus). */
export function tablesIn(state: EditorState, options: LiveMarksOptions): TableModel[] {
  const tables: TableModel[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Table') return;
      if (options.revealsSelection && selectionReveals(state, node.from, node.to)) return false;
      tables.push({ ...tableAt(state, node.from, node.to), selected: options.revealsSelection && selectionCovers(state, node.from, node.to) });
      return false;
    },
  });
  return tables;
}

function tableAt(state: EditorState, from: number, to: number): Omit<TableModel, 'selected'> {
  const first = state.doc.lineAt(from);
  const last = state.doc.lineAt(to);
  const lines = [];
  for (let number = first.number; number <= last.number; number++) lines.push(state.doc.line(number));
  const [header, delimiter, ...rows] = lines;
  return {
    from: first.from,
    to: last.to,
    align: delimiter ? rowCells(delimiter.text, 0).map((cell) => alignOf(cell.text)) : [],
    header: header ? rowCells(header.text, header.from) : [],
    rows: rows.map((row) => rowCells(row.text, row.from)),
  };
}

/** `:--`, `:-:`, `--:` in the delimiter row. */
function alignOf(delimiter: string): ColumnAlign {
  const left = delimiter.startsWith(':');
  const right = delimiter.endsWith(':');
  return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
}

/**
 * A row's cells, each with where its text starts and ends; `\|` and a pipe inside code don't split a cell. The pipes
 * at the row's ends are optional, as GitHub reads them.
 */
export function rowCells(text: string, lineFrom: number): TableCell[] {
  const cells: TableCell[] = [];
  const leading = text.search(/\S/);
  let start = leading >= 0 && text[leading] === '|' ? leading + 1 : 0;
  let inCode = false;
  for (let index = start; index <= text.length; index++) {
    const char = text[index];
    if (char === '`') inCode = !inCode;
    const ends = index === text.length || (char === '|' && !inCode && text[index - 1] !== '\\');
    if (!ends) continue;
    const raw = text.slice(start, index);
    // What follows the last pipe is a cell only when it holds text.
    if (index < text.length || raw.trim()) {
      const lead = raw.length - raw.trimStart().length;
      const trimmed = raw.trim();
      cells.push({ text: trimmed.replace(/\\\|/g, '|'), from: lineFrom + start + lead, to: lineFrom + start + lead + trimmed.length });
    }
    start = index + 1;
  }
  return cells;
}
