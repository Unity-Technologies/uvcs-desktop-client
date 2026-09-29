import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatShortcut } from '../../../lib/shortcuts';
import { hotkey, hotkeys, type ShortcutId } from '../../../lib/shortcutRegistry';
import { IconButton } from '../../../ui/IconButton';
import { PaneToolbarGroup } from '../../../ui/PaneToolbar';
import type { ChangeNavigation } from './useChangeNavigation';
import styles from './ChangeNavigator.module.css';

/**
 * The diff header's way through its changes: previous, where it stands ("3 of 12"), next. Past the first or last
 * change, beside a list of files, the buttons go on to the file before or after.
 */
export function ChangeNavigator({ navigation }: { navigation: ChangeNavigation }) {
  const previous = navigation.goesTo(-1);
  const next = navigation.goesTo(1);
  return (
    <PaneToolbarGroup>
      <IconButton
        size="small"
        icon={<ChevronUp size={14} />}
        label={previous === 'file' ? "Previous file's last change" : 'Previous change'}
        shortcut={hotkey('previousChange')}
        data-tip-sub={alsoWhileTyping('previousChange')}
        disabled={previous === null}
        onClick={() => navigation.go(-1)}
      />
      <span className={styles.position} data-toolbar-extra aria-live="polite">
        {navigation.label}
      </span>
      <IconButton
        size="small"
        icon={<ChevronDown size={14} />}
        label={next === 'file' ? "Next file's first change" : 'Next change'}
        shortcut={hotkey('nextChange')}
        data-tip-sub={alsoWhileTyping('nextChange')}
        disabled={next === null}
        onClick={() => navigation.go(1)}
      />
    </PaneToolbarGroup>
  );
}

/** The shortcut's other key, which works while typing too (the editor moves lines with the first). */
function alsoWhileTyping(id: ShortcutId): string | undefined {
  const other = hotkeys(id)[1];
  return other && `Or ${formatShortcut(other).join('')}, also while typing`;
}
