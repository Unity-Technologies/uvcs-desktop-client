import type { EditorState } from '@codemirror/state';
import { FORMAT_ACTIONS, type FormatAction } from './formatActions';
import { activeFormats, isInCode } from './formatCommands';

export interface ToolbarButton {
  action: FormatAction;
  /** The caret's text has the format: the press takes it away. */
  pressed: boolean;
  enabled: boolean;
}

/**
 * Focus mode's toolbar, the top strip of the field it formats: every format, pressed where the caret's text has it,
 * all but the code block disabled in code. While the caret is in another field (`focused` false: the check-in's
 * summary, whose formats are its keys) every button is disabled: the strip only ever formats its own field.
 */
export function toolbarButtons(state: EditorState, focused: boolean): ToolbarButton[] {
  const active = focused ? activeFormats(state) : new Set();
  const inCode = isInCode(state, state.selection.main.from);
  return FORMAT_ACTIONS.map((action) => ({
    action,
    pressed: active.has(action.id),
    enabled: focused && (!inCode || action.id === 'codeBlock'),
  }));
}
