import { describe, expect, it } from 'vitest';
import { history, undo } from '@codemirror/commands';
import { findClusterBreak, type EditorState } from '@codemirror/state';
import { editorState, run, written } from './commentEditorTesting';
import { typingAt } from './typingAt';
import { justPicked } from './justPicked';
import { liveMarksOf } from './liveMarks';
import { isDismissed, pickSuggestion, suggestionQueryAt, suggestionsShownAt } from './suggestionTrigger';

const queryAt = (written: string) => suggestionQueryAt(editorState(written));

describe('suggestionQueryAt', () => {
  it('opens a list after each trigger, with what was typed since', () => {
    expect(queryAt('Fixes cs:‸')).toEqual({ kind: 'changeset', from: 6, to: 9, text: '' });
    expect(queryAt('On br:/main/ta‸')).toEqual({ kind: 'branch', from: 3, to: 14, text: '/main/ta' });
    expect(queryAt('lb:v1‸')).toMatchObject({ kind: 'label', text: 'v1' });
    expect(queryAt('sh:‸')).toMatchObject({ kind: 'shelve' });
    expect(queryAt('cr:3‸')).toMatchObject({ kind: 'codeReview', text: '3' });
    expect(queryAt('Thanks @‸')).toMatchObject({ kind: 'person', from: 7, text: '' });
    expect(queryAt('Thanks @ana@acme.c‸')).toMatchObject({ kind: 'person', text: 'ana@acme.c' });
  });

  it('opens the emoji list after two letters, so a colon in a sentence opens nothing', () => {
    expect(queryAt('Done :t‸')).toBeNull();
    expect(queryAt('Done :ta‸')).toEqual({ kind: 'emoji', from: 5, to: 8, text: 'ta' });
    expect(queryAt('At 10:30‸')).toBeNull();
    expect(queryAt('Note:‸')).toBeNull();
    expect(queryAt('Note: ‸')).toBeNull();
    expect(queryAt('Smile :)‸')).toBeNull();
  });

  it('opens after a bracket or an emphasis mark, never inside a word, a path or an address', () => {
    expect(queryAt('(cs:1‸')).toMatchObject({ kind: 'changeset', text: '1' });
    expect(queryAt('**@a‸')).toMatchObject({ kind: 'person', text: 'a' });
    expect(queryAt('ana@‸')).toBeNull();
    expect(queryAt('/src/cs:‸')).toBeNull();
    expect(queryAt('See https://ci.acme.com/job?b=br:‸')).toBeNull();
  });

  it('replaces the whole word being typed, past a caret in its middle', () => {
    expect(queryAt('Fixes cs:1‸23 now')).toEqual({ kind: 'changeset', from: 6, to: 12, text: '1' });
  });

  it('opens nothing in code, for a selection, or once a space ends the word', () => {
    expect(queryAt('`cs:‸`')).toBeNull();
    expect(queryAt('```\n@‸\n```')).toBeNull();
    expect(queryAt('«cs:12»')).toBeNull();
    expect(queryAt('cs:12 ‸')).toBeNull();
  });
});

describe('pickSuggestion', () => {
  const pick = (text: string, insert: string) => {
    const state = editorState(text);
    return written(state.update(pickSuggestion(state, suggestionQueryAt(state)!, insert)).state);
  };

  it('writes the pick and a space in place of the word typed, the caret after them', () => {
    expect(pick('Fixes cs:42‸', 'cs:4207')).toBe('Fixes cs:4207 ‸');
    expect(pick('Thanks @an‸a now', '@ana.diaz')).toBe('Thanks @ana.diaz ‸now');
  });

  it('keeps a sentence’s punctuation right after the pick', () => {
    expect(pick('Thanks @an‸a!', '@ana.diaz')).toBe('Thanks @ana.diaz‸!');
    expect(pick('(see cs:42‸)', 'cs:4207')).toBe('(see cs:4207‸)');
  });

  it('is a step of its own to undo, apart from the typing before it', () => {
    const typed = editorState('Fixes ‸', history()).update({ changes: { from: 6, insert: 'cs:42' }, selection: { anchor: 11 }, userEvent: 'input.type' }).state;
    const picked = typed.update(pickSuggestion(typed, suggestionQueryAt(typed)!, 'cs:4207')).state;
    expect(written(run(undo, picked)!)).toBe('Fixes cs:42‸');
  });

  it('steps over a space already there', () => {
    expect(pick('On br:ta‸ today', 'br:/main/task')).toBe('On br:/main/task ‸today');
  });
});

describe('suggestionsShownAt', () => {
  it('opens the list only as the word is typed, never for a reference the field opened with the caret after', () => {
    const opened = editorState('Tested on lb:v1.4.0', typingAt);
    expect(suggestionsShownAt(opened)).toBeNull();
    const typed = opened.update({ changes: { from: opened.doc.length, insert: '1' }, selection: { anchor: opened.doc.length + 1 }, userEvent: 'input.type' }).state;
    expect(suggestionsShownAt(typed)).toMatchObject({ kind: 'label', text: 'v1.4.01' });
  });
});

describe('an emoji picked', () => {
  // Written as escapes: its joiner (U+200D) is invisible, and scanners flag an invisible character in source (`noInvisibleCharacters.test.ts`).
  const rainbowFlag = '\u{1F3F3}\u{FE0F}\u200D\u{1F308}';

  // Backspace and the caret step by the editor's grapheme clusters (`findClusterBreak`), which the commands call.
  it('is one character to Backspace and to the caret, however many code points it holds', () => {
    const text = `Pride ${rainbowFlag}`;
    expect(findClusterBreak(text, text.length, false)).toBe('Pride '.length);
  });
});

describe('a suggestion just picked', () => {
  const picked = (text: string, insert: string) => {
    const state = editorState(text, justPicked);
    return state.update(pickSuggestion(state, suggestionQueryAt(state)!, insert)).state;
  };
  const references = (state: EditorState) => liveMarksOf(state, { revealsSelection: true }).flatMap((mark) => (mark.kind === 'reference' || mark.kind === 'typedReference' ? [mark.kind] : []));

  it('stays drawn as a chip with the caret against it: at a line’s end before another line, and before a sentence’s punctuation', () => {
    const atLineEnd = picked('Fixes cs:42‸\nNext line', 'cs:4207');
    expect(written(atLineEnd)).toBe('Fixes cs:4207‸\nNext line');
    expect(references(atLineEnd)).toEqual(['reference']);
    const beforeStop = picked('See cs:42‸.', 'cs:4207');
    expect(written(beforeStop)).toBe('See cs:4207‸.');
    expect(references(beforeStop)).toEqual(['reference']);
  });

  it('stays drawn in mid-text, with its space', () => {
    const inText = picked('Fixes cs:42‸ now', 'cs:4207');
    expect(written(inText)).toBe('Fixes cs:4207 ‸now');
    expect(references(inText)).toEqual(['reference']);
  });

  it('shows as typed once the caret moves into it, as any chip', () => {
    const state = picked('Fixes cs:42‸\nNext line', 'cs:4207');
    expect(references(state.update({ selection: { anchor: 'Fixes cs:420'.length } }).state)).toEqual(['typedReference']);
  });

  it('is forgotten at the next edit, which the grammar then reads as it reads any', () => {
    const state = picked('Fixes cs:42‸\nNext line', 'cs:4207');
    const typed = state.update({ changes: { from: 'Fixes cs:4207'.length, insert: '1' }, selection: { anchor: 'Fixes cs:42071'.length } }).state;
    expect(typed.field(justPicked)).toBeNull();
    expect(references(typed)).toEqual(['typedReference']);
  });
});

describe('isDismissed', () => {
  it('keeps the list closed for the word Esc closed it on, and opens it for another', () => {
    expect(isDismissed({ kind: 'branch', from: 4, to: 8, text: 'ta' }, 4)).toBe(true);
    expect(isDismissed({ kind: 'branch', from: 12, to: 15, text: 'ma' }, 4)).toBe(false);
    expect(isDismissed({ kind: 'branch', from: 4, to: 8, text: 'ta' }, null)).toBe(false);
  });
});
