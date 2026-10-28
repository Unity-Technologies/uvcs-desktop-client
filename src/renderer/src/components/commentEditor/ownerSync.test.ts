import { describe, expect, it } from 'vitest';
import { history, undo } from '@codemirror/commands';
import { editorState, run, written } from './commentEditorTesting';
import { ownerSync } from './ownerSync';

describe('ownerSync', () => {
  it('is nothing when the owner’s text is the editor’s', () => {
    expect(ownerSync(editorState('Same'), 'Same', false)).toBeNull();
  });

  it('makes a text the owner put in whole (a recent comment picked) a step to undo, back to what was written', () => {
    const typed = editorState('Draft‸', history());
    const replaced = typed.update(ownerSync(typed, 'Fix the switch', false)!).state;
    expect(replaced.doc.toString()).toBe('Fix the switch');
    expect(run(undo, replaced)!.doc.toString()).toBe('Draft');
  });

  it('leaves the owner’s answer to a change just typed out of the history: undo takes back the typing itself', () => {
    const before = editorState('Title‸', history());
    const pasted = before.update({ changes: { from: 5, insert: '\nmore' }, selection: { anchor: 10 }, userEvent: 'input.paste' }).state;
    const kept = pasted.update(ownerSync(pasted, 'Title', true)!).state;
    expect(written(kept)).toBe('Title‸');
    expect((run(undo, kept) ?? kept).doc.toString()).toBe('Title');
  });
});
