import { describe, expect, it } from 'vitest';
import type { EditorState } from '@codemirror/state';
import { editorState, written } from './commentEditorTesting';
import { changeRequestsOpened, openChangeRequests, withChangeRequestsOffered } from './changeRequestTrigger';
import { pickSuggestion, suggestionQueryAt, suggestionsShownAt } from './suggestionTrigger';
import { typingAt } from './typingAt';

const offered = [withChangeRequestsOffered(true), typingAt, changeRequestsOpened];
const queryAt = (text: string) => suggestionQueryAt(editorState(text, offered));

describe('typing [apply', () => {
  it("opens the change requests to apply on cm's own syntax, in any case, with what was typed after it", () => {
    expect(queryAt('Shelve first [apply‸')).toEqual({ kind: 'changeRequest', from: 13, to: 19, text: '' });
    expect(queryAt('[APPLY‸')).toMatchObject({ kind: 'changeRequest', text: '' });
    expect(queryAt('[apply-ch‸')).toMatchObject({ kind: 'changeRequest', text: '' });
    expect(queryAt('[apply-change:‸')).toMatchObject({ kind: 'changeRequest', text: '' });
    expect(queryAt('[apply-change:shelve‸')).toMatchObject({ kind: 'changeRequest', from: 0, text: 'shelve' });
  });

  it('replaces the whole reference being edited, its closing bracket too', () => {
    expect(queryAt('[apply-change:sh‸elve] done')).toEqual({ kind: 'changeRequest', from: 0, to: 21, text: 'sh' });
  });

  it("never opens on a Markdown link's bracket, a word's middle, code, or a reference already closed", () => {
    expect(queryAt('[‸')).toBeNull();
    expect(queryAt('[app‸')).toBeNull();
    expect(queryAt('See [the docs‸')).toBeNull();
    expect(queryAt('[docs](https://acme.com/apply‸')).toBeNull();
    expect(queryAt('word[apply‸')).toBeNull();
    expect(queryAt('[applying‸')).toBeNull();
    expect(queryAt('[apply-chx‸')).toBeNull();
    expect(queryAt('[apply-change‸')).toMatchObject({ kind: 'changeRequest', text: '' });
    expect(queryAt('`[apply‸`')).toBeNull();
    expect(queryAt('[apply-change:c0d1ce00]‸')).toBeNull();
  });

  it('opens nothing where the field offers no change requests', () => {
    expect(suggestionQueryAt(editorState('[apply‸'))).toBeNull();
  });

  it('leaves the code review list on cr: as it is', () => {
    expect(queryAt('cr:‸')).toEqual({ kind: 'codeReview', from: 0, to: 3, text: '' });
  });

  it('picks by writing the whole reference in place of what was typed', () => {
    const state = editorState('Shelve first [apply-change:sh‸', offered);
    const picked = state.update(pickSuggestion(state, suggestionQueryAt(state)!, '[apply-change:c0d1ce00]')).state;
    expect(written(picked)).toBe('Shelve first [apply-change:c0d1ce00] ‸');
  });
});

describe('the list opened by its button', () => {
  const typed = (state: EditorState, text: string): EditorState =>
    state.update({ changes: { from: state.selection.main.head, insert: text }, selection: { anchor: state.selection.main.head + text.length }, userEvent: 'input.type' }).state;

  it('opens at the caret, writing nothing until a pick, which sets a space before the reference after a word', () => {
    const state = editorState('Shelve first‸', offered);
    const opened = state.update(openChangeRequests(state)).state;
    expect(written(opened)).toBe('Shelve first‸');
    const query = suggestionsShownAt(opened);
    expect(query).toEqual({ kind: 'changeRequest', from: 12, to: 12, text: '', prefix: ' ' });
    expect(written(opened.update(pickSuggestion(opened, query!, '[apply-change:c0d1ce00]')).state)).toBe('Shelve first [apply-change:c0d1ce00] ‸');
  });

  it('leaves the text as it was when closed with no pick', () => {
    const state = editorState('Shelve first‸', offered);
    const closed = state.update(openChangeRequests(state)).state.update({ selection: { anchor: 0 } }).state;
    expect(written(closed)).toBe('‸Shelve first');
    expect(suggestionsShownAt(closed)).toBeNull();
  });

  it('opens with no space at a line start or after one', () => {
    for (const text of ['‸', 'Done\n‸', 'Done ‸']) {
      const state = editorState(text, offered);
      const opened = state.update(openChangeRequests(state)).state;
      expect(written(opened)).toBe(text);
      expect(suggestionsShownAt(opened)?.prefix).toBeUndefined();
    }
  });

  it('filters by what is typed after it, and a pick writes the reference in its place', () => {
    const state = editorState('Done ‸', offered);
    const filtering = typed(state.update(openChangeRequests(state)).state, 'shel');
    const query = suggestionsShownAt(filtering);
    expect(query).toEqual({ kind: 'changeRequest', from: 5, to: 9, text: 'shel' });
    expect(written(filtering.update(pickSuggestion(filtering, query!, '[apply-change:c0d1ce00]')).state)).toBe('Done [apply-change:c0d1ce00] ‸');
  });

  it('closes as the caret moves away, a space is typed or the text changes otherwise', () => {
    const state = editorState('Done ‸', offered);
    const opened = state.update(openChangeRequests(state)).state;
    expect(suggestionsShownAt(opened.update({ selection: { anchor: 0 } }).state)).toBeNull();
    expect(suggestionsShownAt(typed(opened, 'a b'))).toBeNull();
    expect(suggestionsShownAt(opened.update({ changes: { from: 0, insert: 'x' } }).state)).toBeNull();
  });
});
