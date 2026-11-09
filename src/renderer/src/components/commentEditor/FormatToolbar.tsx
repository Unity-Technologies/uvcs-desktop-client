import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { FORMAT_ACTIONS, startsBlocks } from './formatActions';
import { FORMAT_COMMANDS } from './formatCommands';
import { focusEditor } from './editorFocus';
import { FormatButton } from './FormatButton';
import { toolbarButtons } from './toolbarButtons';
import styles from './FormatToolbar.module.css';

interface FormatToolbarProps {
  view: EditorView;
  state: EditorState;
  /** Whether the caret is in its field: in the check-in's summary, the description's strip is disabled. */
  focused: boolean;
}

/**
 * Focus mode's toolbar, the top strip of the field it formats (`toolbarButtons`): the selection bar's formats,
 * always shown. Its buttons never take the focus (a press is no click on the text), so the caret and the selection stay.
 */
export function FormatToolbar({ view, state, focused }: FormatToolbarProps) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Format" onMouseDown={(event) => event.preventDefault()}>
      {toolbarButtons(state, focused).map(({ action, pressed, enabled }) => (
        <FormatButton
          key={action.id}
          action={action}
          pressed={pressed}
          enabled={enabled}
          startsBlocks={startsBlocks(FORMAT_ACTIONS, action.id)}
          onPress={() => {
            FORMAT_COMMANDS[action.id](view);
            focusEditor(view);
          }}
        />
      ))}
    </div>
  );
}
