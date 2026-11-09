import { describe, expect, it } from 'vitest';
import type { EditorState } from '@codemirror/state';
import { editorState } from './commentEditorTesting';
import { typingAt } from './typingAt';

function type(state: EditorState, text: string): EditorState {
  const at = state.selection.main.head;
  return state.update({ changes: { from: at, insert: text }, selection: { anchor: at + text.length }, userEvent: 'input.type' }).state;
}

describe('typingAt', () => {
  it('is where the word being typed ends, and nowhere once the caret moves', () => {
    const typed = type(editorState('Fixes ', typingAt), 'cs:12');
    expect(typed.field(typingAt)).toBe(11);
    expect(typed.update({ selection: { anchor: 0 } }).state.field(typingAt)).toBeNull();
  });

  it('goes on through Backspaces taking back what was typed', () => {
    const typed = type(editorState('Fixes ', typingAt), 'cs:12 ');
    const back = typed.update({ changes: { from: 11, to: 12 }, selection: { anchor: 11 }, userEvent: 'delete.backward' }).state;
    expect(back.field(typingAt)).toBe(11);
  });

  it('is nowhere in a field just opened', () => {
    expect(editorState('Fixes cs:12', typingAt).field(typingAt)).toBeNull();
  });
});
