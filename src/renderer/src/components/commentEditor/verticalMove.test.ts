import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { verticalMoveInto } from './verticalMove';

const TEXT = 'Above\n| Name | Size |\n| --- | --- |\n| a | 2 |\nBelow';
const table = { from: 6, to: 45 };

describe('verticalMoveInto', () => {
  it('moves down from the line above a drawn block onto its first line, keeping the column', () => {
    const state = editorState(TEXT);
    expect(verticalMoveInto(state, [table], 3, 1)).toBe(9);
    expect(verticalMoveInto(state, [table], 0, 1)).toBe(6);
  });

  it('moves up from the line below onto its last line', () => {
    const state = editorState(TEXT);
    expect(verticalMoveInto(state, [table], 46, 1)).toBeNull();
    expect(verticalMoveInto(state, [table], 48, -1)).toBe(38);
  });

  it('keeps the column only as far as the line goes', () => {
    const state = editorState('A much longer line above\n| a |\n| --- |');
    expect(verticalMoveInto(state, [{ from: 25, to: 39 }], 20, 1)).toBe(30);
  });

  it('leaves every other move to the editor: no block next to the caret', () => {
    const state = editorState(TEXT);
    expect(verticalMoveInto(state, [table], 3, -1)).toBeNull();
    expect(verticalMoveInto(state, [], 3, 1)).toBeNull();
  });
});
