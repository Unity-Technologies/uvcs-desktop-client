import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatShortcut } from '../../../lib/shortcuts';
import { hotkey, hotkeys, type ShortcutId } from '../../../lib/shortcutRegistry';
import { IconButton } from '../../../ui/IconButton';
import { PaneToolbarGroup } from '../../../ui/PaneToolbar';
import type { StepNavigation } from './useStepNavigation';
import styles from './ChangeNavigator.module.css';

interface ChangeNavigatorProps {
  navigation: StepNavigation;
  /** The second key of each shortcut also works while typing in the view (F7 in a diff's editor). */
  keysWhileTyping?: boolean;
}

/**
 * A view's way through its changes (or conflicts: the navigation's noun): previous, where it stands ("3 of 12"), next.
 * Past the first or last, beside a list of files, the buttons go on to the file before or after.
 */
export function ChangeNavigator({ navigation, keysWhileTyping = false }: ChangeNavigatorProps) {
  const { noun, shortcuts } = navigation;
  const previous = navigation.goesTo(-1);
  const next = navigation.goesTo(1);
  return (
    <PaneToolbarGroup>
      <IconButton
        size="small"
        icon={<ChevronUp size={14} />}
        label={previous === 'file' ? `Previous file's last ${noun}` : `Previous ${noun}`}
        shortcut={hotkey(shortcuts.previous)}
        data-tip-sub={otherKey(shortcuts.previous, keysWhileTyping)}
        disabled={previous === null}
        onClick={() => navigation.go(-1)}
      />
      <span className={styles.position} data-toolbar-extra aria-live="polite">
        {navigation.label}
      </span>
      <IconButton
        size="small"
        icon={<ChevronDown size={14} />}
        label={next === 'file' ? `Next file's first ${noun}` : `Next ${noun}`}
        shortcut={hotkey(shortcuts.next)}
        data-tip-sub={otherKey(shortcuts.next, keysWhileTyping)}
        disabled={next === null}
        onClick={() => navigation.go(1)}
      />
    </PaneToolbarGroup>
  );
}

/** The shortcut's other key; in a diff it works while typing too (the editor moves lines with the first). */
function otherKey(id: ShortcutId, whileTyping: boolean): string | undefined {
  const other = hotkeys(id)[1];
  return other && `Or ${formatShortcut(other).join('')}${whileTyping ? ', also while typing' : ''}`;
}
