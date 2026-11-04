import type { RefObject } from 'react';
import { CHANGE_SHORTCUTS } from './useChangeNavigation';
import type { KeptPresses } from './stepQueue';
import { useStepNavigation, type StepNavigation, type StepView } from './useStepNavigation';

const NO_STEPS: readonly unknown[] = [];

/** No view to step through: nothing shows, nothing to reveal. */
const NO_VIEW: StepView = { isShown: () => false, reveal: () => undefined, countAbove: () => 0, aboveAfterChange: () => 0 };

/** How a navigation with no diff of its own holds its presses. */
interface FileOnlyOptions {
  /** Its keys work; off while another navigation of the same header takes them (a loaded diff's). */
  active?: boolean;
  /** Waiting for the selected file's diff, its presses kept for it, or stepless, from file to file (`PressHolder`). */
  holder?: 'waiting' | 'stepless';
  /** The file it stands for, as the list names it: the one its presses are kept for or replayed from. */
  path?: string;
  /** Where its presses are kept (`useStepNavigation`'s `kept`). */
  kept?: KeptPresses;
}

/**
 * The navigation of a diff header with no diff of its own to step through (one loading or failed, an xlink): file to
 * file beside a list (`FileStepsContext`), with the keys while `active`, or its presses kept for the file that loads.
 * It opens nothing, so the arrival meant for the diff that loads stays that diff's.
 */
export function useFileOnlyNavigation(frame: RefObject<HTMLElement | null>, { active = true, holder = 'stepless', path = '', kept }: FileOnlyOptions = {}): StepNavigation {
  return useStepNavigation({ steps: NO_STEPS, view: NO_VIEW, frame, path, noun: 'change', shortcuts: CHANGE_SHORTCUTS, active, holder, kept });
}
