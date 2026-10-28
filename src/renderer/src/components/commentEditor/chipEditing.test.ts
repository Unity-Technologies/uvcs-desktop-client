import { describe, expect, it } from 'vitest';
import { editorState, written } from './commentEditorTesting';
import { selectChip } from './chipEditing';

describe('selectChip', () => {
  it('selects the chip’s text', () => {
    const state = editorState('Fixes cs:12 now');
    expect(written(state.update(selectChip({ from: 6, to: 11 })).state)).toBe('Fixes «cs:12» now');
  });
});
