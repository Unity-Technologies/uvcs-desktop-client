import { ChevronDown, ChevronUp } from 'lucide-react';
import { useContext, type Ref } from 'react';
import { formatShortcut } from '../../../lib/shortcuts';
import { hotkey, hotkeys, type ShortcutId } from '../../../lib/shortcutRegistry';
import { IconButton } from '../../../ui/IconButton';
import { changeNavigatorView } from './changeNavigatorView';
import { FileStepsContext } from './fileSteps';
import type { StepNavigation } from './useStepNavigation';
import styles from './ChangeNavigator.module.css';

interface ChangeNavigatorProps {
  navigation: StepNavigation;
  /** The view steps through steps of its own (a text diff's changes, a merged file's conflicts), not only files. */
  stepsOwn: boolean;
  /** The second key of each shortcut also works while typing in the view (F7 in a diff's editor). */
  keysWhileTyping?: boolean;
  /** The arrows' element: what the keys of a navigation with no view of its own work from (`FileOnlyNavigator`). */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A view's way through its changes (or conflicts: the navigation's noun), at the far right of its header: where it
 * stands ("3 of 12"), right-aligned so it grows leftward, then previous and next, side by side at the edge. Past the
 * first or last, beside a list of files, the arrows go on to the file before or after (`changeNavigatorView`).
 */
export function ChangeNavigator({ navigation, stepsOwn, keysWhileTyping = false, ref }: ChangeNavigatorProps) {
  const besideFiles = useContext(FileStepsContext) !== null;
  const { noun, shortcuts, count, label } = navigation;
  const view = changeNavigatorView({ stepsOwn, count, label, noun, previous: navigation.goesTo(-1), next: navigation.goesTo(1), besideFiles });
  if (!view) return null;
  return (
    <div ref={ref} className={styles.navigator}>
      <span className={styles.position} data-toolbar-extra aria-live="polite">
        {view.label}
      </span>
      <IconButton
        size="small"
        icon={<ChevronUp size={14} />}
        label={view.previous.tip}
        shortcut={hotkey(shortcuts.previous)}
        data-tip-sub={otherKey(shortcuts.previous, keysWhileTyping)}
        disabled={!view.previous.enabled}
        onClick={() => navigation.go(-1)}
      />
      <IconButton
        size="small"
        icon={<ChevronDown size={14} />}
        label={view.next.tip}
        shortcut={hotkey(shortcuts.next)}
        data-tip-sub={otherKey(shortcuts.next, keysWhileTyping)}
        disabled={!view.next.enabled}
        onClick={() => navigation.go(1)}
      />
    </div>
  );
}

/** The shortcut's other key; in a diff it works while typing too (the editor moves lines with the first). */
function otherKey(id: ShortcutId, whileTyping: boolean): string | undefined {
  const other = hotkeys(id)[1];
  return other && `Or ${formatShortcut(other).join('')}${whileTyping ? ', also while typing' : ''}`;
}
