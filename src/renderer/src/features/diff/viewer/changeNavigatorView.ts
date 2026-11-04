import { positionLabel } from './changeNavigation';

/**
 * What a view's change arrows show (`ChangeNavigator`), at the far right of its header: in the same place for every
 * diff (text, image, model, binary, identical, loading, an error), so stepping on with ↓ never moves the arrow under
 * the pointer.
 */

/** What decides the arrows: the view's own steps, where each arrow goes (`StepNavigation.goesTo`), the list beside it. */
export interface NavigatorFacts {
  /** The view steps through steps of its own: a text diff of two versions (its changes), a merged file (its conflicts). */
  stepsOwn: boolean;
  count: number;
  /** The step moved to; none before the first move. */
  current: number | null;
  /** What a step is: "change", "conflict". */
  noun: string;
  previous: 'step' | 'file' | null;
  next: 'step' | 'file' | null;
  /** A list of files is beside the view (`FileStepsContext`): past the ends, the arrows go on to its files. */
  besideFiles: boolean;
}

export interface NavigatorArrow {
  tip: string;
  enabled: boolean;
}

export interface NavigatorView {
  /** "3 of 12" while a step is current; empty otherwise, the arrows then standing alone. */
  label: string;
  previous: NavigatorArrow;
  next: NavigatorArrow;
}

/**
 * The arrows of a view: always beside a list of files, even with nothing to step through (they go on to the files, and
 * stay, disabled, at the list's ends), so they never come and go from file to file; with no list, only for steps of its
 * own (a diff on its own with none has nowhere to go: no arrows at all, which is as stable). The label has one form,
 * "3 of 12" (`positionLabel`); how many there are rides on the arrows' tips.
 */
export function changeNavigatorView(facts: NavigatorFacts): NavigatorView | null {
  if (!facts.besideFiles && facts.count === 0) return null;
  const hasSteps = facts.stepsOwn && facts.count > 0;
  const inFile = hasSteps ? ` · ${facts.count} in this file` : '';
  return {
    label: hasSteps ? positionLabel(facts) : '',
    previous: arrowOf(facts.previous, hasSteps, `Previous ${facts.noun}${inFile}`, `Previous file's last ${facts.noun}`, 'Previous file'),
    next: arrowOf(facts.next, hasSteps, `Next ${facts.noun}${inFile}`, `Next file's first ${facts.noun}`, 'Next file'),
  };
}

function arrowOf(goesTo: 'step' | 'file' | null, hasSteps: boolean, toStep: string, toFileStep: string, toFile: string): NavigatorArrow {
  if (goesTo === 'step') return { tip: toStep, enabled: true };
  if (goesTo === 'file') return { tip: hasSteps ? toFileStep : toFile, enabled: true };
  return { tip: hasSteps ? toStep : toFile, enabled: false };
}
