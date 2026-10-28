import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { hotkey } from '../../lib/shortcutRegistry';
import { toolbarButtons } from './toolbarButtons';
import { FORMAT_COMMANDS } from './formatCommands';
import styles from './SelectionBar.module.css';

/** Where the inline formats end and the blocks start: a hairline between the two groups. */
const FIRST_BLOCK = 'bullet';

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
      {toolbarButtons(state, focused).map(({ action: { id, label, icon: Icon, shortcutId }, pressed, enabled }) => (
        <span key={id} className={styles.group} data-starts-blocks={id === FIRST_BLOCK || undefined}>
          <button
            type="button"
            className={styles.button}
            aria-label={label}
            aria-pressed={pressed}
            disabled={!enabled}
            data-tip={label}
            data-tip-shortcut={shortcutId && hotkey(shortcutId)}
            tabIndex={-1}
            onClick={() => {
              FORMAT_COMMANDS[id](view);
              view.focus();
            }}
          >
            <Icon size={15} strokeWidth={2.25} aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}
