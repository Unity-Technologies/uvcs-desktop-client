import { describe, expect, it } from 'vitest';
import type { EditorState } from '@codemirror/state';
import { deleteChip } from './chipEditing';
import { editorState, run, written } from './commentEditorTesting';
import { liveMarksOf } from './liveMarks';
import { typingAt } from './typingAt';

const FOCUSED = { revealsSelection: true };

function type(state: EditorState, text: string): EditorState {
  const at = state.selection.main.head;
  return state.update({ changes: { from: at, insert: text }, selection: { anchor: at + text.length }, userEvent: 'input.type' }).state;
}

const kinds = (state: EditorState) => liveMarksOf(state, FOCUSED).map((mark) => mark.kind);

describe('typingAt', () => {
  it('shows a reference being typed as text, and as a chip once the caret moves on', () => {
    const typed = type(editorState('Fixes ', typingAt), 'cs:12');
    expect(kinds(typed)).toEqual(['typedReference']);
    expect(kinds(type(typed, ' '))).toEqual(['reference']);
    expect(kinds(typed.update({ selection: { anchor: 0 } }).state)).toEqual(['reference']);
  });

  it('takes back the last key of a reference being typed, then a chip whole once it is one', () => {
    const typed = type(editorState('Fixes ', typingAt), 'cs:12');
    const corrected = run(deleteChip(false), typed);
    expect(corrected).toBeNull();
    const chip = typed.update({ selection: { anchor: 0 } }).state.update({ selection: { anchor: 11 } }).state;
    expect(written(run(deleteChip(false), chip)!)).toBe('Fixes ‸');
  });

  it('goes on through Backspaces taking back what was typed', () => {
    const typed = type(editorState('Fixes ', typingAt), 'cs:12 ');
    const back = typed.update({ changes: { from: 11, to: 12 }, selection: { anchor: 11 }, userEvent: 'delete.backward' }).state;
    expect(back.field(typingAt)).toBe(11);
    expect(kinds(back)).toEqual(['typedReference']);
  });
});
