import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { formatsOf, selectionBarPosition, selectionBarShows } from './selectionBar';

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

describe('selectionBarPosition', () => {
  const bar = { width: 200, height: 30 };
  const window = { width: 820, height: 600 };

  it('centers the bar over the selection', () => {
    expect(selectionBarPosition({ left: 300, right: 400, top: 200, bottom: 218 }, bar, window)).toEqual({ left: 250, top: 164 });
  });

  it('puts it under the selection without room above', () => {
    expect(selectionBarPosition({ left: 300, right: 400, top: 20, bottom: 38 }, bar, window)).toEqual({ left: 250, top: 44 });
  });

  it('keeps it inside the window', () => {
    expect(selectionBarPosition({ left: 0, right: 20, top: 200, bottom: 218 }, bar, window).left).toBe(8);
    expect(selectionBarPosition({ left: 800, right: 818, top: 200, bottom: 218 }, bar, window).left).toBe(612);
  });
});
