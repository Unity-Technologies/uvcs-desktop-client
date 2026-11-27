import { forwardRef, Fragment, type KeyboardEvent } from 'react';
import { TAKES_ESCAPE } from '../../../lib/modalDialog';
import { isMac } from '../../../lib/platform';
import { Kbd } from '../../../ui/Kbd';
import { recordedKey } from './keyboardRows';
import styles from './KeyboardPane.module.css';

interface ShortcutKeysButtonProps {
  label: string;
  keys: readonly string[];
  /** A person changed them: the caps take the accent color. */
  changed: boolean;
  recording: boolean;
  onRecord: () => void;
  onPressed: (key: string) => void;
  onStop: () => void;
}

/**
 * A shortcut's keys, as a button that records new ones: clicked, it takes the next keys pressed (`recordedKey`)
 * before anything else does; Esc (which leaves Settings open: `TAKES_ESCAPE`), Tab or leaving it stops.
 */
export const ShortcutKeysButton = forwardRef<HTMLButtonElement, ShortcutKeysButtonProps>(function ShortcutKeysButton(
  { label, keys, changed, recording, onRecord, onPressed, onStop },
  ref,
) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!recording) return;
    const pressed = recordedKey(event.nativeEvent, isMac);
    if (pressed.action === 'leave') return onStop();
    event.preventDefault();
    event.stopPropagation();
    if (pressed.action === 'stop') onStop();
    else if (pressed.action === 'record') onPressed(pressed.key);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={styles.keysButton}
      data-recording={recording || undefined}
      data-changed={changed || undefined}
      {...(recording && TAKES_ESCAPE)}
      aria-label={recording ? `Press the new keys for ${label}` : `Change the keys of ${label}`}
      onClick={recording ? undefined : onRecord}
      onKeyDown={onKeyDown}
      onBlur={recording ? onStop : undefined}
    >
      {recording ? (
        <span className={styles.prompt}>Press keys…</span>
      ) : keys.length === 0 ? (
        <span className={styles.prompt}>None</span>
      ) : (
        keys.map((key, index) => (
          <Fragment key={key}>
            {index > 0 && <span className={styles.or}>/</span>}
            <Kbd keys={key} />
          </Fragment>
        ))
      )}
    </button>
  );
});
