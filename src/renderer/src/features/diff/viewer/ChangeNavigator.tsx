import { ChevronDown, ChevronUp } from 'lucide-react';
import { useContext, useState, type MouseEvent, type Ref } from 'react';
import { settleClickFocus } from '../../../lib/focusRing';
import { formatShortcut } from '../../../lib/shortcuts';
import { hotkey, hotkeys } from '../../../lib/shortcutRegistry';
import { type ShortcutId } from '@shared/shortcuts/shortcutRegistry';
import { IconButton } from '../../../ui/IconButton';
import { PaneToolbarGroup } from '../../../ui/PaneToolbar';
import { changeNavigatorView, heldLabel } from './changeNavigatorView';
import { FileStepsContext } from './fileSteps';
import type { StepNavigation } from './useStepNavigation';
import styles from './ChangeNavigator.module.css';

interface ChangeNavigatorProps {
  navigation: StepNavigation;
  /** The view steps through steps of its own (a text diff's changes, a merged file's conflicts), not only files. */
  stepsOwn: boolean;
  /** The view lets its diffs step through their changes, whatever the file shown (`NavigatorFacts.hostSteps`). */
  hostSteps?: boolean;
  /** The second key of each shortcut also works while typing in the view (F7 in a diff's editor). */
  keysWhileTyping?: boolean;
  /** Where it sits, beyond the header's end (`ConflictNavigator`'s view bar). */
  className?: string;
  /** The arrows' element: what the keys of a navigation with no view of its own work from (`FileOnlyNavigator`). */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A view's way through its changes (or conflicts: the navigation's noun), at the far right of its header: where it
 * stands ("3 of 12"), right-aligned so it grows leftward, then previous and next, side by side at the edge. Past the
 * first or last, beside a list of files, the arrows go on to the file before or after, their tips naming that file
 * (`changeNavigatorView`).
 */
export function ChangeNavigator({ navigation, stepsOwn, hostSteps = true, keysWhileTyping = false, className, ref }: ChangeNavigatorProps) {
  const files = useContext(FileStepsContext);
  const { noun, shortcuts, count, current } = navigation;
  const neighbors = files ? { previous: files.neighbor(-1), next: files.neighbor(1) } : undefined;
  const view = changeNavigatorView({ stepsOwn, count, current, noun, previous: navigation.goesTo(-1), next: navigation.goesTo(1), besideFiles: files !== null, hostSteps, neighbors, filePosition: files?.position });
  // While the next file is read, the count shown keeps its place, faded out only if the read is slow (`heldLabel`).
  const [held, setHeld] = useState('');
  const shownLabel = view ? heldLabel(held, view) : '';
  if (shownLabel !== held) setHeld(shownLabel);
  if (!view) return null;
  // A click leaves the arrow focused with no ring (`settleClickFocus`), Enter or Space as Chromium decides.
  const step = (event: MouseEvent<HTMLButtonElement>, direction: 1 | -1): void => {
    navigation.go(direction);
    settleClickFocus(event);
  };
  return (
    <PaneToolbarGroup ref={ref} className={className}>
      <span className={view.waiting ? `${styles.position} ${styles.waiting}` : styles.position} data-toolbar-extra aria-live="polite" aria-hidden={view.waiting || undefined}>
        {shownLabel}
      </span>
      <IconButton
        size="small"
        icon={<ChevronUp size={14} />}
        label={view.previous.tip}
        shortcut={hotkey(shortcuts.previous)}
        data-tip-sub={otherKey(shortcuts.previous, keysWhileTyping)}
        disabled={!view.previous.enabled}
        onClick={(event) => step(event, -1)}
      />
      <IconButton
        size="small"
        icon={<ChevronDown size={14} />}
        label={view.next.tip}
        shortcut={hotkey(shortcuts.next)}
        data-tip-sub={otherKey(shortcuts.next, keysWhileTyping)}
        disabled={!view.next.enabled}
        onClick={(event) => step(event, 1)}
      />
    </PaneToolbarGroup>
  );
}

/** The shortcut's other key; in a diff it works while typing too (the editor moves lines with the first). */
function otherKey(id: ShortcutId, whileTyping: boolean): string | undefined {
  const other = hotkeys(id)[1];
  return other && `Or ${formatShortcut(other).join('')}${whileTyping ? ', also while typing' : ''}`;
}
