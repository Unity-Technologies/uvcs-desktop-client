import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { toolbarButtons } from './toolbarButtons';

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

  it('disables all but the code block in code, where Markdown’s marks are the code’s own', () => {
    expect(marked(toolbarButtons(editorState('```\nlet a‸\n```'), false))).toEqual(['bold off', 'italic off', 'strikethrough off', 'code off', 'link off', 'bullet off', 'task off', 'numbered off', 'quote off', 'codeBlock on']);
  });
});
