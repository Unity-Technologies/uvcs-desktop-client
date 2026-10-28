import { describe, expect, it } from 'vitest';
import { editorState, written } from './commentEditorTesting';
import { pickSuggestion, suggestionQueryAt } from './suggestionTrigger';

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

  it('steps over a space already there', () => {
    expect(pick('On br:ta‸ today', 'br:/main/task')).toBe('On br:/main/task ‸today');
  });
});
