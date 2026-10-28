import { describe, expect, it } from 'vitest';
import { history, undo } from '@codemirror/commands';
import { editorState, run, written } from './commentEditorTesting';
import { chipsOnLine, deleteChip, selectChip } from './chipEditing';

describe('deleteChip', () => {
  it('takes a whole chip away with Backspace right after it', () => {
    expect(written(run(deleteChip(false), editorState('Fixes cs:12‸ now'))!)).toBe('Fixes ‸ now');
    expect(written(run(deleteChip(false), editorState('Thanks @ana@acme.com‸'))!)).toBe('Thanks ‸');
    expect(written(run(deleteChip(false), editorState('Done :tada:‸'))!)).toBe('Done ‸');
  });

  it('takes a whole chip away with Delete right before it', () => {
    expect(written(run(deleteChip(true), editorState('On ‸br:/main/task.'))!)).toBe('On ‸.');
  });

  it('takes an image away whole too', () => {
    expect(written(run(deleteChip(false), editorState('![icon](https://example.com/a.png)‸'))!)).toBe('‸');
  });

  it('leaves the key its usual work anywhere else', () => {
    expect(run(deleteChip(false), editorState('Fixes cs:1‸2'))).toBeNull();
    expect(run(deleteChip(false), editorState('Fixes cs:12 ‸'))).toBeNull();
    expect(run(deleteChip(false), editorState('Fixes «cs:12»'))).toBeNull();
    expect(run(deleteChip(false), editorState('`cs:12‸`'))).toBeNull();
  });

  it('is one step to undo', () => {
    const deleted = run(deleteChip(false), editorState('Fixes cs:12‸', history()))!;
    expect(written(run(undo, deleted)!)).toBe('Fixes cs:12‸');
  });
});

describe('selectChip', () => {
  it('selects the chip’s text', () => {
    const state = editorState('Fixes cs:12 now');
    const [chip] = chipsOnLine(state, 0);
    expect(written(state.update(selectChip(chip!)).state)).toBe('Fixes «cs:12» now');
  });
});
