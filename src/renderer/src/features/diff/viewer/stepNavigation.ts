import { currentAfterChange, plannedMove, type ChangePosition } from './changeNavigation';
import type { ArrowGoal } from './changeNavigatorView';
import type { FileSteps } from './fileSteps';

/**
 * The decisions of moving step by step (`useStepNavigation`), apart from the screen, so the tests that walk a list of
 * files take the very ones the views take.
 */

/**
 * What a press of next (1) or previous (-1) did: moved to a step (its index), went on to a file beside it (its path), or
 * nothing.
 */
export type PressOutcome = number | { file: string } | null;

/**
 * Presses next or previous from `position`: before the first move, from where the view stands (`readAbove`, read
 * then); past the last or first step, on to the file after or before it in the list beside the view (`files`), which
 * it selects.
 */
export function pressStep(position: ChangePosition, direction: 1 | -1, files: FileSteps | null, readAbove: () => number): PressOutcome {
  const from = position.current === null ? { ...position, above: readAbove() } : position;
  const move = plannedMove(from, direction, files?.canStep(direction) ?? false);
  if (move?.to === 'file') {
    const file = files!.step(direction);
    return file === null ? null : { file };
  }
  return move?.index ?? null;
}

/**
 * Where an arrow goes (`StepNavigation.goesTo`: its tip, and whether it's enabled). While its presses are kept
 * (`pressTarget`, a header's queue), `'queued'`: enabled both ways, as the keys are, whatever the list beside it says,
 * which may already be on its last file while the diff shown is still the previous one's. Otherwise through the steps,
 * on to the file beside it past the ends, or nowhere.
 */
export function stepGoal(position: ChangePosition, direction: 1 | -1, files: Pick<FileSteps, 'canStep'> | null, kept: boolean): ArrowGoal {
  if (kept) return 'queued';
  return plannedMove(position, direction, files?.canStep(direction) ?? false)?.to ?? null;
}

/**
 * The position once the steps changed (typed into a diff, a conflict resolved): the step moved to stays while there
 * are as many; `above` is how many start above where the view stands now (`StepView.aboveAfterChange`).
 */
export function positionAfterChange(position: ChangePosition, before: readonly unknown[], after: readonly unknown[], above: number): ChangePosition {
  return { count: after.length, current: currentAfterChange(position.current, before, after), above };
}
