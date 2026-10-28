import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { pressHidesBar, pressPlacesCaret, selectionBarShows } from './selectionBarState';

describe('selectionBarShows', () => {
  it('shows over text selected in the focused field once the pointer lets go', () => {
    expect(selectionBarShows(editorState('Fix «the switch»'), true, false, false)).toBe(true);
    expect(selectionBarShows(editorState('Fix «the switch»'), true, true, false)).toBe(false);
    expect(selectionBarShows(editorState('Fix «the switch»'), false, false, false)).toBe(false);
    expect(selectionBarShows(editorState('Fix the switch‸'), true, false, false)).toBe(false);
  });

  it('stays away from focus mode, whose toolbar holds the formats', () => {
    expect(selectionBarShows(editorState('Fix «the switch»'), true, false, true)).toBe(false);
  });

  it('stays away from a code block', () => {
    expect(selectionBarShows(editorState('```\nlet «a» = 1\n```'), true, false, false)).toBe(false);
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

describe('pressPlacesCaret', () => {
  const press = { button: 0, onText: false, inBox: true, onControl: false };

  it('puts the caret where a press lands in the box but not on its text: the padding, under the last line', () => {
    expect(pressPlacesCaret(press)).toBe(true);
  });

  it('leaves the text’s own presses to the editor, and every other button’s to the window', () => {
    expect(pressPlacesCaret({ ...press, onText: true })).toBe(false);
    expect(pressPlacesCaret({ ...press, button: 2 })).toBe(false);
  });

  it('leaves a press on a control in the box to it (the toolbar, the corner button, a chip’s link), and one from a popup outside it', () => {
    expect(pressPlacesCaret({ ...press, onControl: true })).toBe(false);
    expect(pressPlacesCaret({ ...press, inBox: false })).toBe(false);
  });
});
