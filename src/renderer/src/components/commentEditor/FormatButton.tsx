import { hotkey } from '../../lib/shortcutRegistry';
import type { FormatAction } from './formatActions';
import styles from './FormatButton.module.css';

interface FormatButtonProps {
  action: FormatAction;
  pressed: boolean;
  enabled?: boolean;
  /** The first block format shown (`startsBlocks`): a hairline before it. */
  startsBlocks: boolean;
  onPress: () => void;
}

/**
 * A format's button, in the selection bar and in focus mode's toolbar: its name and key in its tooltip, pressed where
 * the text has it. It never takes the focus (`tabIndex` -1, and its bar keeps the press from the text).
 */
export function FormatButton({ action: { label, icon: Icon, shortcutId }, pressed, enabled = true, startsBlocks, onPress }: FormatButtonProps) {
  return (
    <span className={styles.group} data-starts-blocks={startsBlocks || undefined}>
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-pressed={pressed}
        disabled={!enabled}
        data-tip={label}
        data-tip-shortcut={shortcutId && hotkey(shortcutId)}
        tabIndex={-1}
        onClick={onPress}
      >
        <Icon size={15} strokeWidth={2.25} aria-hidden />
      </button>
    </span>
  );
}
