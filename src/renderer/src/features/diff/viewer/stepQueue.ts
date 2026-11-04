/** A press of next (1) or previous (-1). */
export type StepDirection = 1 | -1;

/**
 * The presses kept for a file whose diff hasn't taken them yet (being read, drawn, not opened at its arrival, or still
 * the previous file's while a step settles), each tagged with the path of the file it's for, as the list beside the
 * diff names it. One per diff header (`SteppedDiffFrame`): the header and the diffs put presses in (`headerKeepsFor`,
 * `pressTarget`), the selected file's diff takes its own once it opened (`drainsKept`). A step from a file takes the
 * presses left for it along (`retag`); presses are dropped only when the selection leaves their file (`keepOnly`), so a
 * file picked while another loads opens at its top.
 */
export class StepQueue {
  private presses: { path: string; direction: StepDirection }[] = [];

  push(path: string, direction: StepDirection): void {
    this.presses.push({ path, direction });
  }

  /** The next press kept for `path`; those for other files stay. */
  take(path: string): StepDirection | undefined {
    const index = this.presses.findIndex((press) => press.path === path);
    if (index === -1) return undefined;
    return this.presses.splice(index, 1)[0]!.direction;
  }

  /** The presses left for `from` go to `to`, in order: a step from `from` went to `to`, and they're meant to follow it. */
  retag(from: string, to: string): void {
    this.presses = this.presses.map((press) => (press.path === from ? { ...press, path: to } : press));
  }

  /** Drops the presses for any file but these (the file asked for, the one a step is on its way to). */
  keepOnly(paths: readonly (string | null)[]): void {
    this.presses = this.presses.filter((press) => paths.includes(press.path));
  }

  clear(): void {
    this.presses = [];
  }
}

/** Where a press goes: a step through the view, or kept for the file it's meant for. */
export type PressTarget = { kind: 'step' } | { kind: 'keep'; path: string };

/**
 * What a press on a view's arrows or keys does (`useStepNavigation`'s `go`). A step to another file still in flight
 * (`FileSteps.steppingTo`: the list already on it, the diff shown still the previous one's while the selection settles
 * and the file is read) keeps it for that file, never stepping from the previous one's place; so does a view that hasn't
 * opened at its arrival yet, for itself, else the arrival would move it back. A view that opens nothing steps at once.
 */
export function pressTarget({ opens, opened, steppingTo, path }: { opens: boolean; opened: boolean; steppingTo: string | null; path: string }): PressTarget {
  if (!opens) return { kind: 'step' };
  if (steppingTo !== null && steppingTo !== path) return { kind: 'keep', path: steppingTo };
  return opened ? { kind: 'step' } : { kind: 'keep', path };
}

/** A queue of presses tagged with the file they're for, and whether a view takes its own from it. */
export interface KeptPresses {
  queue: StepQueue;
  takes: boolean;
}

/**
 * Where a view's presses wait (`useStepNavigation`'s `kept`): those a diff header hands it, while it's the selected
 * file's (`LoadedFileDiff`); else its list's (`FileSteps.kept`), which the lists of one view share, so a conflict's view
 * takes the presses a step from a diff left it; else its own, with no list beside it.
 */
export function keptPressesOf(kept: KeptPresses | undefined, files: { kept: StepQueue } | null, own: KeptPresses): KeptPresses {
  if (kept) return kept;
  return files ? { queue: files.kept, takes: true } : own;
}

/** Whether a diff takes the presses kept for it: once it opened at its arrival, while it's the selected file's. */
export function drainsKept({ opened, selected }: { opened: boolean; selected: boolean }): boolean {
  return opened && selected;
}

/**
 * What a press did: moved the view to a step, went on to another file, was kept for a file whose view hasn't opened,
 * or nothing (past the last change of the last file, before the first of the first).
 */
export type PressEffect = 'moved' | 'file' | 'kept' | 'none';

/** A press that went on to the file `to` (or nowhere: `null`): the presses left for `from` follow it there. */
export function followStep(queue: StepQueue, from: string, to: string | null): PressEffect {
  if (to === null) return 'none';
  queue.retag(from, to);
  return 'file';
}

/**
 * Hands the presses kept for `path` to its view (`go`), once it may (`drainsKept`). A press that does something is the
 * last for now: the render a move brings takes the next, from where it left the view, and a press gone on to another
 * file, or kept for one, leaves the rest to that file. A press that does nothing brings no render, so the next is taken
 * at once, never left waiting for one.
 */
export function drainKept(queue: StepQueue, path: string, go: (direction: StepDirection) => PressEffect): void {
  for (let press = queue.take(path); press !== undefined; press = queue.take(path)) {
    if (go(press) !== 'none') return;
  }
}
