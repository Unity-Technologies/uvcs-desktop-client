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
  /**
   * The view lets its diffs step through their changes (`LoadedFileDiff`'s `stepsThroughChanges`): a setting of the
   * view, the same for every file it shows, not of the file shown. Off where the view steps through its own steps
   * instead (a merge page's conflict arrows).
   */
  hostSteps: boolean;
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
 * The arrows of a view, decided by the view, never by the file shown, so they never come and go from file to file:
 * beside a list of files always (they go on to the files, and stay, disabled, at the list's ends); with no list, in
 * every diff of a view that steps through changes (History, Files: disabled on an image), and in none of one that
 * doesn't (a merge page's diff, whose conflict arrows step instead). The label has one form, "3 of 12"
 * (`positionLabel`); how many there are rides on the arrows' tips.
 */
export function changeNavigatorView(facts: NavigatorFacts): NavigatorView | null {
  if (!facts.besideFiles && !facts.hostSteps) return null;
  const hasSteps = facts.stepsOwn && facts.count > 0;
  const inFile = hasSteps ? ` · ${facts.count} in this file` : '';
  // With nothing to step through and no files to go on to, the arrows name the changes they'd step through.
  const namesFiles = facts.besideFiles && !hasSteps;
  return {
    label: hasSteps ? positionLabel(facts) : '',
    previous: arrowOf(facts.previous, namesFiles, `Previous ${facts.noun}${inFile}`, `Previous file's last ${facts.noun}`, 'Previous file'),
    next: arrowOf(facts.next, namesFiles, `Next ${facts.noun}${inFile}`, `Next file's first ${facts.noun}`, 'Next file'),
  };
}

function arrowOf(goesTo: 'step' | 'file' | null, namesFiles: boolean, toStep: string, toFileStep: string, toFile: string): NavigatorArrow {
  if (goesTo === 'step') return { tip: toStep, enabled: true };
  if (goesTo === 'file') return { tip: namesFiles ? toFile : toFileStep, enabled: true };
  return { tip: namesFiles ? toFile : toStep, enabled: false };
}
