import { describe, expect, it } from 'vitest';
import { history, undo } from '@codemirror/commands';
import type { EditorState } from '@codemirror/state';
import { editorState, run, written } from './commentEditorTesting';
import { ownerExchange } from './ownerSync';

/** Types `text` at the caret, a key at a time, as CodeMirror's input does. */
function type(state: EditorState, text: string): EditorState {
  let typed = state;
  for (const key of text) {
    const at = typed.selection.main.head;
    typed = typed.update({ changes: { from: at, insert: key }, selection: { anchor: at + 1 }, userEvent: 'input.type' }).state;
  }
  return typed;
}

describe('ownerExchange', () => {
  it('is nothing when the owner’s text is the editor’s', () => {
    const same = editorState('Same');
    expect(ownerExchange().synced(same, same, 'Same')).toBeNull();
  });

  it('makes a text the owner put in whole (a recent comment picked) a step to undo, back to what was written', () => {
    const typed = editorState('Draft‸', history());
    const replaced = typed.update(ownerExchange().synced(typed, typed, 'Fix the switch')!).state;
    expect(replaced.doc.toString()).toBe('Fix the switch');
    expect(run(undo, replaced)!.doc.toString()).toBe('Draft');
  });

  it('takes the owner’s answer to text just sent, out of the history, though it equals a text sent before', () => {
    // `Fix` agreed; a space, then lines pasted before the owner rendered: the summary answers `Fix ` and hands `more`
    // to the description. `Fix ` was sent too, a moment before, but it's the owner's answer, not its echo.
    const exchange = ownerExchange();
    const agreed = editorState('Fix‸', history());
    expect(exchange.synced(agreed, agreed, 'Fix')).toBeNull();
    const spaced = type(agreed, ' ');
    exchange.typed();
    const pasted = spaced.update({ changes: { from: 4, insert: '\nmore' }, selection: { anchor: 9 }, userEvent: 'input.paste' }).state;
    exchange.typed();
    const answered = pasted.update(exchange.synced(pasted, pasted, 'Fix ')!).state;
    expect(written(answered)).toBe('Fix ‸');
    expect((run(undo, answered) ?? answered).doc.toString()).toBe('Fix');
  });

  it('never takes back a key typed between a render and its effect: the owner agreed with what that render showed', () => {
    const exchange = ownerExchange();
    const shown = type(editorState('‸'), 'x br:/main/t');
    exchange.typed();
    const live = type(shown, 'a');
    exchange.typed();
    expect(exchange.synced(live, shown, 'x br:/main/t')).toBeNull();
  });

  it('never loses or reorders keys typed fast, whatever number of them lands before each render’s effect', () => {
    // React renders the field's state and its owner's value together; each render's effect runs one to three keys later.
    const exchange = ownerExchange();
    let live = editorState('‸');
    let rendered = live;
    const keys = 'x br:/main/task-2210 more';
    for (const [index, key] of [...keys].entries()) {
      live = type(live, key);
      exchange.typed();
      if (index % 3 === 0) rendered = live;
      if (index % 3 === 2) {
        const sync = exchange.synced(live, rendered, rendered.doc.toString());
        if (sync) live = live.update(sync).state;
      }
    }
    expect(written(live)).toBe(`${keys}‸`);
  });

  it('makes a text put in after the two agreed again its own step to undo, as no typing waits for an answer', () => {
    const exchange = ownerExchange();
    const typed = type(editorState('‸', history()), 'Dra');
    exchange.typed();
    expect(exchange.synced(typed, typed, 'Dra')).toBeNull();
    const replaced = typed.update(exchange.synced(typed, typed, 'A recent comment')!).state;
    expect(run(undo, replaced)!.doc.toString()).toBe('Dra');
  });

  it('takes the field as rendered from the live state before the first render', () => {
    const live = editorState('Draft');
    expect(ownerExchange().synced(live, null, 'Draft')).toBeNull();
    expect(ownerExchange().synced(live, null, 'Other')).not.toBeNull();
  });
});
