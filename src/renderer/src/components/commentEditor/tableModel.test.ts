import { describe, expect, it } from 'vitest';
import type { EditorState } from '@codemirror/state';
import { editorState } from './commentEditorTesting';
import { rowCells, tablesIn } from './tableModel';

const TABLE = '| Name | Size |\n| :--- | ---: |\n| a.png | 2 MB |';

describe('tablesIn', () => {
  it('reads a table the caret isn’t in: its alignment, header and rows, each cell where it is written', () => {
    const [table] = tablesIn(editorState(`${TABLE}\n\nAfter‸`), { revealsSelection: true });
    expect(table).toEqual({
      from: 0,
      to: TABLE.length,
      selected: false,
      align: ['left', 'right'],
      header: [
        { text: 'Name', from: 2, to: 6 },
        { text: 'Size', from: 9, to: 13 },
      ],
      rows: [
        [
          { text: 'a.png', from: 34, to: 39 },
          { text: '2 MB', from: 42, to: 46 },
        ],
      ],
    });
  });

  it('leaves the table the caret is in to show as typed, unless the field has no focus', () => {
    const state = editorState(`| Na‸me | Size |\n| --- | --- |`);
    expect(tablesIn(state, { revealsSelection: true })).toEqual([]);
    expect(tablesIn(state, { revealsSelection: false })).toHaveLength(1);
  });

  it('draws a table a selection covers or reaches into, marked as selected, unless the selection started in it', () => {
    const text = `Above\n${TABLE}\n\nBelow`;
    const selecting = (anchor: number, head: number) => editorState(text).update({ selection: { anchor, head } }).state;
    const drawnSelected = (state: EditorState) => tablesIn(state, { revealsSelection: true }).map((table) => table.selected);
    expect(drawnSelected(selecting(text.length, 0))).toEqual([true]);
    expect(drawnSelected(selecting(text.length, 10))).toEqual([true]);
    expect(drawnSelected(selecting(text.length, text.length - 2))).toEqual([false]);
    expect(drawnSelected(selecting(10, text.length))).toEqual([]);
  });
});

describe('rowCells', () => {
  it('splits at pipes, but not an escaped one or one in code', () => {
    expect(rowCells('| a \\| b | `x|y` |', 0).map((cell) => cell.text)).toEqual(['a | b', '`x|y`']);
  });

  it('reads a row without its outer pipes', () => {
    expect(rowCells('a | b', 10)).toEqual([
      { text: 'a', from: 10, to: 11 },
      { text: 'b', from: 14, to: 15 },
    ]);
  });

  it('keeps an empty cell', () => {
    expect(rowCells('|  | b |', 0).map((cell) => cell.text)).toEqual(['', 'b']);
  });
});
