import { describe, expect, it } from 'vitest';
import { history, undo } from '@codemirror/commands';
import { editorState, run, written } from './commentEditorTesting';
import { ownerSync } from './ownerSync';

describe('ownerSync', () => {
  it('is nothing when the owner’s text is the editor’s', () => {
    expect(ownerSync(editorState('Same'), 'Same', [])).toBeNull();
  });

  it('makes a text the owner put in whole (a recent comment picked) a step to undo, back to what was written', () => {
    const typed = editorState('Draft‸', history());
    const replaced = typed.update(ownerSync(typed, 'Fix the switch', [])!).state;
    expect(replaced.doc.toString()).toBe('Fix the switch');
    expect(run(undo, replaced)!.doc.toString()).toBe('Draft');
  });

  it('leaves the owner’s answer to a change just typed out of the history: undo takes back the typing itself', () => {
    const before = editorState('Title‸', history());
    const pasted = before.update({ changes: { from: 5, insert: '\nmore' }, selection: { anchor: 10 }, userEvent: 'input.paste' }).state;
    const kept = pasted.update(ownerSync(pasted, 'Title', ['Title\nmore'])!).state;
    expect(written(kept)).toBe('Title‸');
    expect((run(undo, kept) ?? kept).doc.toString()).toBe('Title');
  });

  it('never takes back keys typed fast: an owner’s value one or more keys behind is the echo of the field’s own text', () => {
    // Keys at 0 ms apart: the field sent each text to its owner, whose renders bring them back late, out of step.
    let state = editorState('‸');
    const sent: string[] = [];
    const owner: string[] = [];
    for (const key of 'x br:/main/task-2210 more') {
      const at = state.selection.main.head;
      state = state.update({ changes: { from: at, insert: key }, selection: { anchor: at + 1 }, userEvent: 'input.type' }).state;
      sent.push(state.doc.toString());
      owner.push(state.doc.toString());
      // A render now and then, with the value the owner had when it began: keys behind.
      if (owner.length % 3 === 0) {
        const late = owner[owner.length - 3]!;
        const sync = ownerSync(state, late, sent);
        if (sync) state = state.update(sync).state;
      }
    }
    expect(written(state)).toBe('x br:/main/task-2210 more‸');
  });

  it('still takes a text the owner puts in while keys were being typed', () => {
    const typed = editorState('Dra‸');
    expect(ownerSync(typed, 'A recent comment', ['D', 'Dr', 'Dra'])).not.toBeNull();
  });
});
