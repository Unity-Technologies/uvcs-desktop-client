import type { RefObject } from 'react';
import { CHANGE_SHORTCUTS } from './useChangeNavigation';
import { useStepNavigation, type StepNavigation, type StepView } from './useStepNavigation';

const NO_STEPS: readonly unknown[] = [];

/** No view to step through: nothing shows, nothing to reveal. */
const NO_VIEW: StepView = { isShown: () => false, reveal: () => undefined, countAbove: () => 0, aboveAfterChange: () => 0 };

/**
 * The navigation of a diff header with no diff of its own to step through (one loading or failed, an xlink): file to
 * file beside a list (`FileStepsContext`), with the keys while `active`, or, given `goes`, its presses kept for the
 * file that loads. It opens nothing and names no file, so the arrival meant for the diff that loads stays that diff's.
 */
export function useFileOnlyNavigation(frame: RefObject<HTMLElement | null>, active = true, goes?: (direction: 1 | -1) => void): StepNavigation {
  return useStepNavigation({ steps: NO_STEPS, view: NO_VIEW, frame, path: '', noun: 'change', shortcuts: CHANGE_SHORTCUTS, active, opens: false, goes });
}
