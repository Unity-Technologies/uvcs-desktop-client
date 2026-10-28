import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { toolbarButtons } from './toolbarButtons';

describe('toolbarButtons', () => {
  /** The buttons that aren't plain: `bold on`, `quote off`. */
  const marked = (buttons: ReturnType<typeof toolbarButtons>) =>
    buttons.filter((button) => button.pressed || !button.enabled).map(({ action, pressed, enabled }) => `${action.id}${pressed ? ' on' : ''}${enabled ? '' : ' off'}`);

  it('shows each format pressed where the caret’s text has it', () => {
    expect(marked(toolbarButtons(editorState('- Fix **the‸** switch'), true))).toEqual(['bold on', 'bullet on']);
  });

  it('disables every button while the caret is in another field (the check-in’s summary): the strip formats its own', () => {
    expect(marked(toolbarButtons(editorState('**Fix‸**'), false))).toEqual(['bold off', 'italic off', 'strikethrough off', 'code off', 'link off', 'bullet off', 'task off', 'numbered off', 'quote off', 'codeBlock off']);
  });

  it('disables all but the code block in code, where Markdown’s marks are the code’s own', () => {
    expect(marked(toolbarButtons(editorState('```\nlet a‸\n```'), true))).toEqual(['bold off', 'italic off', 'strikethrough off', 'code off', 'link off', 'bullet off', 'task off', 'numbered off', 'quote off', 'codeBlock on']);
  });
});
