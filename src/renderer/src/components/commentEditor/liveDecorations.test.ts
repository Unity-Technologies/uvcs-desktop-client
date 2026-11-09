import { describe, expect, it } from 'vitest';
import { RangeSet } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { editorState } from './commentEditorTesting';
import { liveDecorationsOf } from './liveDecorations';
import { liveMarksOf } from './liveMarks';

/** 150 lines of three chips each, the size a long comment reaches. */
const LONG = Array.from({ length: 150 }, (_, line) => `Line ${line}: cs:${(line % 6) + 1} and br:/main/task-2210 by @ana`).join('\n');

describe('liveDecorationsOf, as a key is typed in a long comment', () => {
  it('changes only the edited line’s decorations: CodeMirror keeps every other chip’s DOM, drawn once', () => {
    const before = editorState(`‸${LONG}`);
    const typed = before.update({ changes: { from: 0, insert: 'q' }, selection: { anchor: 1 }, userEvent: 'input.type' });
    const drawn = (state: typeof before) => Decoration.set(liveDecorationsOf(liveMarksOf(state, { revealsSelection: true })), true);
    let changed = 0;
    RangeSet.compare([drawn(before)], [drawn(typed.state)], typed.changes, {
      compareRange: () => changed++,
      comparePoint: () => changed++,
    });
    // At most the edited line's three chips and their marks: none of the other 447.
    expect(changed).toBeLessThanOrEqual(4);
  });
});
