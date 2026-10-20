import { currentAfterChange, plannedMove, type ChangePosition } from './changeNavigation';
import type { FileSteps } from './fileSteps';

/**
 * The decisions of moving step by step (`useStepNavigation`), apart from the screen, so the tests that walk a list of
 * files take the very ones the views take.
 */

/** What a press of next (1) or previous (-1) did: moved to a step (its index), went on to a file beside it, or nothing. */
export type PressOutcome = number | 'file' | null;

/**
 * Presses next or previous from `position`: before the first move, from where the view stands (`readAbove`, read
 * then); past the last or first step, on to the file after or before it in the list beside the view (`files`), which
 * it selects.
 */
export function pressStep(position: ChangePosition, direction: 1 | -1, files: FileSteps | null, readAbove: () => number): PressOutcome {
  const from = position.current === null ? { ...position, above: readAbove() } : position;
  const move = plannedMove(from, direction, files?.canStep(direction) ?? false);
  if (move?.to === 'file') {
    files!.step(direction);
    return 'file';
  }
  return move?.index ?? null;
}

/**
 * The position once the steps changed (typed into a diff, a conflict resolved): the step moved to stays while there
 * are as many; `above` is how many start above where the view stands now (`StepView.aboveAfterChange`).
 */
export function positionAfterChange(position: ChangePosition, before: readonly unknown[], after: readonly unknown[], above: number): ChangePosition {
  return { count: after.length, current: currentAfterChange(position.current, before, after), above };
}
