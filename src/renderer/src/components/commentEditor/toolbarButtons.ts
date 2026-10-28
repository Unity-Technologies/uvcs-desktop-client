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
 * Focus mode's toolbar for the field with the caret: every format, so the toolbar holds still as the caret goes from
 * the check-in's summary to its description, those the field can't take disabled (the blocks on one line, all but the
 * code block in code).
 */
export function toolbarButtons(state: EditorState, singleLine: boolean): ToolbarButton[] {
  const active = activeFormats(state);
  const inCode = isInCode(state, state.selection.main.from);
  return FORMAT_ACTIONS.map((action) => ({
    action,
    pressed: active.has(action.id),
    enabled: !(singleLine && action.block) && (!inCode || action.id === 'codeBlock'),
  }));
}
