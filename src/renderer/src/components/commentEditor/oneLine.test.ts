import { describe, expect, it } from 'vitest';
import { insertNewlineAndIndent } from '@codemirror/commands';
import type { EditorState } from '@codemirror/state';
import { withSummaryText, type CommentParts } from '../../lib/comment';
import { editorState, run, written } from './commentEditorTesting';
import { changeToMatch } from './commentFieldText';
import { oneLine, ownerChange } from './oneLine';

const insert = (state: EditorState, text: string, userEvent: string) =>
  state.update({ changes: { from: state.selection.main.head, insert: text }, selection: { anchor: state.selection.main.head + text.length }, userEvent }).state;

describe('oneLine', () => {
  it('turns Shift+Enter’s line end into a space', () => {
    expect(written(run(insertNewlineAndIndent, editorState('Title‸', oneLine))!)).toBe('Title ‸');
  });

  it('turns the lines of a drop into one', () => {
    expect(written(insert(editorState('A ‸', oneLine), 'b\nc', 'input.drop'))).toBe('A b c‸');
  });

  it('keeps a paste’s lines, and the owner’s, for the owner to place', () => {
    expect(insert(editorState('‸', oneLine), 'a\nb', 'input.paste').doc.toString()).toBe('a\nb');
    const owned = editorState('', oneLine).update({ changes: { from: 0, insert: 'a\nb' }, annotations: ownerChange.of(true) }).state;
    expect(owned.doc.toString()).toBe('a\nb');
  });
});

describe('a summary field and its owner', () => {
  /**
   * The editor's text once its owner took it: the owner keeps the parts (`withSummaryText`), and the editor follows
   * the summary they give back whenever it differs from its text, as `LiveCommentEditor` does after each change.
   */
  function typeInSummary(keys: string[]): { text: string; parts: CommentParts } {
    let text = '';
    let parts: CommentParts = { summary: '', description: '' };
    for (const key of keys) {
      text += key;
      parts = withSummaryText(parts, text);
      const change = changeToMatch(text, parts.summary);
      if (change) text = text.slice(0, change.from) + change.insert + text.slice(change.to);
    }
    return { text, parts };
  }

  it('never writes the description twice when a line end reaches the summary', () => {
    expect(typeInSummary(['Title', '\n', 'x', 'y'])).toEqual({ text: 'Titlexy', parts: { summary: 'Titlexy', description: '' } });
  });
});
