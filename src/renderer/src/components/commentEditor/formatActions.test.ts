import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { FORMAT_ACTIONS, formatsOf, toolbarButtons } from './formatActions';

describe('FORMAT_ACTIONS', () => {
  it('lists the formats once, the inline ones first, each with its name and, but the task list, its key', () => {
    expect(FORMAT_ACTIONS.map(({ id, label, shortcut, block }) => [id, label, shortcut ?? null, block])).toEqual([
      ['bold', 'Bold', 'commentBold', false],
      ['italic', 'Italic', 'commentItalic', false],
      ['strikethrough', 'Strikethrough', 'commentStrikethrough', false],
      ['code', 'Code', 'commentCode', false],
      ['link', 'Link', 'commentLink', false],
      ['bullet', 'List', 'commentList', true],
      ['task', 'Task list', null, true],
      ['numbered', 'Numbered list', 'commentNumberedList', true],
      ['quote', 'Quote', 'commentQuote', true],
      ['codeBlock', 'Code block', 'commentCodeBlock', true],
    ]);
  });
});

describe('formatsOf', () => {
  it('offers a one-line field the inline formats, and a comment of many lines the blocks too', () => {
    expect(formatsOf(true)).toEqual(['bold', 'italic', 'strikethrough', 'code', 'link']);
    expect(formatsOf(false)).toEqual(['bold', 'italic', 'strikethrough', 'code', 'link', 'bullet', 'task', 'numbered', 'quote', 'codeBlock']);
  });
});

describe('toolbarButtons', () => {
  /** The buttons that aren't plain: `bold on`, `quote off`. */
  const marked = (buttons: ReturnType<typeof toolbarButtons>) =>
    buttons.filter((button) => button.pressed || !button.enabled).map(({ action, pressed, enabled }) => `${action.id}${pressed ? ' on' : ''}${enabled ? '' : ' off'}`);

  it('shows each format pressed where the caret’s text has it', () => {
    expect(marked(toolbarButtons(editorState('- Fix **the‸** switch'), false))).toEqual(['bold on', 'bullet on']);
  });

  it('keeps every button for a one-line field, the blocks disabled, so the toolbar holds still as the caret moves between fields', () => {
    expect(marked(toolbarButtons(editorState('Fix ‸'), true))).toEqual(['bullet off', 'task off', 'numbered off', 'quote off', 'codeBlock off']);
  });

  it('disables the inline formats in code, where Markdown’s marks are the code’s own', () => {
    expect(marked(toolbarButtons(editorState('```\nlet a‸\n```'), false))).toEqual(['bold off', 'italic off', 'strikethrough off', 'code off', 'link off', 'codeBlock on']);
  });
});
