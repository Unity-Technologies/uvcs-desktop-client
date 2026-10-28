import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { formatsOf, pressHidesBar, selectionBarShows } from './selectionBarState';

describe('formatsOf', () => {
  it('offers a one-line field the inline formats, and a comment of many lines the blocks too', () => {
    expect(formatsOf(true)).toEqual(['bold', 'italic', 'strikethrough', 'code', 'link']);
    expect(formatsOf(false)).toEqual(['bold', 'italic', 'strikethrough', 'code', 'link', 'bullet', 'task', 'quote', 'codeBlock']);
  });
});

describe('selectionBarShows', () => {
  it('shows over text selected in the focused field once the pointer lets go', () => {
    expect(selectionBarShows(editorState('Fix «the switch»'), true, false)).toBe(true);
    expect(selectionBarShows(editorState('Fix «the switch»'), true, true)).toBe(false);
    expect(selectionBarShows(editorState('Fix «the switch»'), false, false)).toBe(false);
    expect(selectionBarShows(editorState('Fix the switch‸'), true, false)).toBe(false);
  });

  it('stays away from a code block', () => {
    expect(selectionBarShows(editorState('```\nlet «a» = 1\n```'), true, false)).toBe(false);
  });
});

describe('pressHidesBar', () => {
  // React hands the field a press on its popups too (the bar is a portal of it): only a press on the text itself is
  // a selection being made.
  const field = { contains: (node: unknown) => node === 'text' };

  it('hides the bar while the pointer presses in the text', () => {
    expect(pressHidesBar(field, 'text')).toBe(true);
  });

  it('keeps it for a press on the bar’s own buttons, so their click runs', () => {
    expect(pressHidesBar(field, 'bar button')).toBe(false);
  });
});
