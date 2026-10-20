import { useEffect, useMemo, type RefObject } from 'react';
import { ChangeNavigator } from '../../diff/viewer/ChangeNavigator';
import { goesSomewhere, useStepNavigation, type StepShortcuts, type StepView } from '../../diff/viewer/useStepNavigation';

const CONFLICT_SHORTCUTS: StepShortcuts = { next: 'nextConflict', previous: 'previousConflict' };

interface ConflictNavigatorProps {
  /** The conflicts to step through (`conflictsToStep`). */
  count: number;
  /** The conflicts on screen (`useConflictView`); a binary's choice has none to scroll to. */
  view: StepView;
  /** The panel: the keys work from it, from the list beside it and with nothing focused. */
  frame: RefObject<HTMLElement | null>;
  /** The file, as the list beside it names it (`FileStepsContext`). */
  path: string;
}

/**
 * A conflicting file's arrows around "2 of 3", with the diff's keys (⌥↓ ⌥↑, F7 ⇧F7): from conflict to conflict, then,
 * beside the merge's list, on to the next file that waits for the user (`conflictStepKeys`). Resolving a conflict takes
 * it out of the count, and the next move goes on from the view.
 */
export function ConflictNavigator({ count, view, frame, path }: ConflictNavigatorProps) {
  const steps = useMemo(() => Array.from({ length: count }, (_, index) => index), [count]);
  const navigation = useStepNavigation({ steps, view, frame, path, noun: 'conflict', shortcuts: CONFLICT_SHORTCUTS });

  // Scroll events don't bubble: the panel listens as they go down to the conflicts' scrolling surface.
  const { onViewScroll } = navigation;
  useEffect(() => {
    const panel = frame.current;
    panel?.addEventListener('scroll', onViewScroll, { capture: true, passive: true });
    return () => panel?.removeEventListener('scroll', onViewScroll, { capture: true });
  }, [frame, onViewScroll]);

  return goesSomewhere(navigation) ? <ChangeNavigator navigation={navigation} /> : null;
}
