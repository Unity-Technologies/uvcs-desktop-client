import { plannedMove, type ChangePosition } from './changeNavigation';
import type { ArrowGoal } from './changeNavigatorView';
import type { FileSteps } from './fileSteps';
import { pressStep } from './stepNavigation';
import type { StepQueue } from './stepQueue';

/**
 * Where a press of the change arrows or their keys goes, decided in one place for every navigation that takes them
 * (`useStepNavigation`: a diff's, a conflicts view's, a diff header's own, an xlink's) and for the tests that walk a list
 * of files through them (`stepThroughLoads.test.ts`), so the two can't wire it differently.
 */

/**
 * What holds the presses: a view with steps of its own that opens at its arrival (a diff, a merged file's conflicts);
 * a diff header waiting for the selected file's diff, read or drawn, whose presses are that diff's; or one with no view
 * to step through (a file that couldn't be read, an xlink), which goes from file to file.
 */
export type PressHolder = 'view' | 'waiting' | 'stepless';

/** Where a press is made. */
export interface PressSpot {
  holder: PressHolder;
  /** The file it shows, as the list beside it names it: what the presses kept for it are tagged with. */
  path: string;
  /** A view opened at its arrival (`openingStep`); before, a press would be undone by the arrival. */
  opened: boolean;
  /** The file a step went to while the view shown is still the previous one's (`FileSteps.steppingTo`). */
  steppingTo: string | null;
  /** The file the list is on while the view beside it still shows another (`FileSteps.settlingOn`: Changes' settle). */
  settlingOn: string | null;
}

/** A press goes through the view's steps (on to the file beside it past the ends), or is kept for a file. */
export type PressRoute = { kind: 'step' } | { kind: 'keep'; path: string };

/**
 * The route of a press: kept for the file a step is on its way to, or the list is on while the view beside it settles,
 * never stepping from the previous file's place (an unreadable file's or an xlink's too, which would step on from it
 * twice); kept for the view itself until it opened at
 * its arrival, or for the selected file's diff while a header waits for it; a step otherwise.
 */
export function routePress({ holder, path, opened, steppingTo, settlingOn }: PressSpot): PressRoute {
  const ahead = steppingTo ?? settlingOn;
  if (ahead !== null && ahead !== path) return { kind: 'keep', path: ahead };
  if (holder === 'stepless') return { kind: 'step' };
  return holder === 'waiting' || !opened ? { kind: 'keep', path } : { kind: 'step' };
}

/**
 * Where an arrow goes (`StepNavigation.goesTo`: its tip, and whether it's enabled). A press that would be kept is
 * `'queued'`: enabled both ways, as the keys are, whatever the list beside it says, which may already be on its last
 * file while the view shown is still the previous one's. Otherwise through the steps, on to the file beside it past the
 * ends, or nowhere.
 */
export function pressGoal(spot: PressSpot, position: ChangePosition, direction: 1 | -1, files: Pick<FileSteps, 'canStep'> | null): ArrowGoal {
  if (routePress(spot).kind === 'keep') return 'queued';
  return plannedMove(position, direction, files?.canStep(direction) ?? false)?.to ?? null;
}

/**
 * What a press did: moved the view to a step, went on to another file, was kept for a file whose view hasn't taken it,
 * or nothing (past the last change of the last file, before the first of the first).
 */
export type PressEffect = 'moved' | 'file' | 'kept' | 'none';

/** What a press acts on: where its view stands and how it moves, the files beside it, and where kept presses wait. */
export interface PressTargets {
  position: ChangePosition;
  files: Pick<FileSteps, 'canStep' | 'step'> | null;
  queue: StepQueue;
  /** How many steps start above where the view stands, read from the screen for the first move. */
  readAbove: () => number;
  moveTo: (index: number) => void;
}

/**
 * Presses next (1) or previous (-1) from `spot` (`routePress`): keeps it, moves the view, or goes on to the file beside
 * it, the presses left for this file following it there, in order.
 */
export function applyPress(direction: 1 | -1, spot: PressSpot, { position, files, queue, readAbove, moveTo }: PressTargets): PressEffect {
  const route = routePress(spot);
  if (route.kind === 'keep') {
    queue.push(route.path, direction);
    return 'kept';
  }
  const outcome = pressStep(position, direction, files, readAbove);
  if (typeof outcome === 'number') {
    moveTo(outcome);
    return 'moved';
  }
  if (outcome === null) return 'none';
  queue.retag(spot.path, outcome.file);
  return 'file';
}

/**
 * Whether a navigation takes the presses kept for its file (`drainKept`): a view once it opened at its arrival, while
 * it's the selected file's (not a previous one still on screen); one with no steps at once, replaying them as steps
 * from file to file, as its view never comes; never a header waiting for the selected file's diff, whose they are.
 */
export function takesKept(holder: PressHolder, { opened, selected }: { opened: boolean; selected: boolean }): boolean {
  if (holder === 'waiting') return false;
  return selected && (holder === 'stepless' || opened);
}
