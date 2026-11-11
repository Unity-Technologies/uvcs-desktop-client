import { describe, expect, it } from 'vitest';
import { history, undo } from '@codemirror/commands';
import type { EditorState } from '@codemirror/state';
import { editorState, run, written } from './commentEditorTesting';
import { emoticonAfterTyping, emoticonBeforeLineBreak, justReplacedEmoticon, revertEmoticon } from './emoticonTyping';

const typingEmoticons = [history(), justReplacedEmoticon];

/** Types `text` key by key at the caret, as the field does: each key, then the emoticon it ends turned into its emoji. */
function type(state: EditorState, text: string): EditorState {
  let next = state;
  for (const key of text) {
    const at = next.selection.main.head;
    next = next.update({ changes: { from: at, insert: key }, selection: { anchor: at + key.length }, userEvent: 'input.type' }).state;
    const replacement = emoticonAfterTyping(next, at, key);
    if (replacement) next = next.update(replacement).state;
  }
  return next;
}

function typed(before: string, text: string): string {
  return written(type(editorState(before, typingEmoticons), text));
}

describe('emoticonAfterTyping', () => {
  it('turns an emoticon into its emoji as a space is typed after it', () => {
    expect(typed('Done ', ':-) ')).toBe('Done 🙂 ‸');
  });

  it('turns it after the punctuation that ends a phrase, which stays', () => {
    expect(typed('Done ', ':D!')).toBe('Done 😄!‸');
    expect(typed('', ';),')).toBe('😉,‸');
    expect(typed('Really ', ":'(.")).toBe('Really 😢.‸');
  });

  it('leaves it as typed until a key ends it', () => {
    expect(typed('Done ', ':-)')).toBe('Done :-)‸');
    expect(typed('Done ', ':-))')).toBe('Done :-))‸');
  });

  it('turns one after an opening bracket or at a line start', () => {
    expect(typed('(', ':-) ')).toBe('(🙂 ‸');
    expect(typed('First\n', ':-/ ')).toBe('First\n😕 ‸');
    expect(typed('- ', ':P ')).toBe('- 😛 ‸');
  });

  it("leaves a lettered list's items", () => {
    expect(typed('A-) Build\n', 'B-) ')).toBe('A-) Build\nB-) ‸');
  });

  it('leaves text that only ends like one: a word, an address, a port', () => {
    expect(typed('a', ':-) ')).toBe('a:-) ‸');
    expect(typed('Open http://host', ':8080 ')).toBe('Open http://host:8080 ‸');
    expect(typed('See https://example.com/', ':-) ')).toBe('See https://example.com/:-) ‸');
  });

  it('leaves code: a code block, a code span, and a code span still being typed', () => {
    expect(typed('```\nreturn ‸\n```', ':) ')).toBe('```\nreturn :) ‸\n```');
    expect(typed('```ts\n', ':-) ')).toBe('```ts\n:-) ‸');
    expect(typed('    indented ', ':-) ')).toBe('    indented :-) ‸');
    expect(typed('Run `a ‸b`', ':-) ')).toBe('Run `a :-) ‸b`');
    expect(typed('Run `a ', ':-) ')).toBe('Run `a :-) ‸');
  });

  it('turns one after a code span closed on the line', () => {
    expect(typed('Run `make` ', ':-) ')).toBe('Run `make` 🙂 ‸');
  });

  it("leaves a link's text and an image's description", () => {
    expect(typed('[Read ‸](https://example.com)', ':-) ')).toBe('[Read :-) ‸](https://example.com)');
    expect(typed('![Smiling ‸](https://example.com/a.png)', ':-) ')).toBe('![Smiling :-) ‸](https://example.com/a.png)');
  });

  it('turns nothing with several carets', () => {
    const state = editorState('a ', typingEmoticons);
    const twoCarets = state.update({ selection: { anchor: 0 } }).state.update({ selection: state.selection.addRange(state.selection.main) }).state;
    expect(emoticonAfterTyping(twoCarets, 2, ' ')).toBeNull();
  });
});

describe('emoticonBeforeLineBreak', () => {
  it('turns the emoticon before the caret into its emoji, the caret after it', () => {
    const state = editorState('Thanks :-)‸', typingEmoticons);
    expect(written(state.update(emoticonBeforeLineBreak(state)!).state)).toBe('Thanks 🙂‸');
  });

  it('turns nothing with a selection, or with no emoticon before the caret', () => {
    expect(emoticonBeforeLineBreak(editorState('Thanks «:-)»', typingEmoticons))).toBeNull();
    expect(emoticonBeforeLineBreak(editorState('Thanks‸', typingEmoticons))).toBeNull();
  });
});

describe('undoing an emoticon turned into its emoji', () => {
  it('takes one undo, which brings the emoticon back as typed', () => {
    const state = type(editorState('', typingEmoticons), 'Done :-) ');
    expect(written(run(undo, state)!)).toBe('Done :-) ‸');
  });

  it('takes one Backspace right after, which brings it back too', () => {
    const state = type(editorState('', typingEmoticons), 'Done :-) ');
    expect(written(run(revertEmoticon, state)!)).toBe('Done :-) ‸');
  });

  it('leaves Backspace to delete as always once anything else happened', () => {
    const state = type(editorState('', typingEmoticons), 'Done :-) a');
    expect(run(revertEmoticon, state)).toBeNull();
    expect(run(revertEmoticon, state.update({ selection: { anchor: 0 } }).state)).toBeNull();
    expect(run(revertEmoticon, editorState('Done 🙂 ', typingEmoticons))).toBeNull();
  });
});
