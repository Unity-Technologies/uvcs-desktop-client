import { useRef } from 'react';
import { ChangeNavigator } from './ChangeNavigator';
import { CHANGE_SHORTCUTS } from './useChangeNavigation';
import { useStepNavigation, type StepView } from './useStepNavigation';

const NO_STEPS: readonly unknown[] = [];

/** No view to step through: nothing shows, nothing to reveal. */
const NO_VIEW: StepView = { isShown: () => false, reveal: () => undefined, countAbove: () => 0, aboveAfterChange: () => 0 };

/**
 * The change arrows of a diff header with no diff to step through yet (loading, failed to load, an xlink): they go from
 * file to file beside a list (`FileStepsContext`), so they stand where a loaded diff's will, and ↓ pressed while the next
 * file loads goes on. It names no file (`path`), so it never takes the arrival meant for the diff that loads.
 */
export function FileOnlyNavigator() {
  const frame = useRef<HTMLDivElement>(null);
  const navigation = useStepNavigation({ steps: NO_STEPS, view: NO_VIEW, frame, path: '', noun: 'change', shortcuts: CHANGE_SHORTCUTS });
  return <ChangeNavigator ref={frame} navigation={navigation} stepsOwn={false} keysWhileTyping />;
}
