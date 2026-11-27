import { forwardRef, Fragment, type KeyboardEvent } from 'react';
import { pressedShortcut } from '../../../lib/shortcuts';
import { Kbd } from '../../../ui/Kbd';
import styles from './KeyboardPane.module.css';

interface ShortcutKeysButtonProps {
  label: string;
  keys: readonly string[];
  recording: boolean;
  onRecord: () => void;
  onPressed: (key: string) => void;
  onStop: () => void;
}

/**
 * A shortcut's keys, as a button that records new ones: clicked, it takes the next keys pressed (`pressedShortcut`)
 * before anything else does; Esc, Tab or leaving it stops.
 */
export const ShortcutKeysButton = forwardRef<HTMLButtonElement, ShortcutKeysButtonProps>(function ShortcutKeysButton(
  { label, keys, recording, onRecord, onPressed, onStop },
  ref,
) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!recording) return;
    if (event.key === 'Tab') return onStop();
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') return onStop();
    const key = pressedShortcut(event.nativeEvent);
    if (key) onPressed(key);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={styles.keysButton}
      data-recording={recording || undefined}
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
