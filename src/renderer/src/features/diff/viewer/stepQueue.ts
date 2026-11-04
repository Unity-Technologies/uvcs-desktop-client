import type { PressEffect } from './pressRouting';

/** A press of next (1) or previous (-1). */
export type StepDirection = 1 | -1;

/**
 * The presses kept for a file whose diff hasn't taken them yet (being read, drawn, not opened at its arrival, or still
 * the previous file's while a step settles), each tagged with the path of the file it's for, as the list beside the
 * diff names it. The list's (`FileSteps.kept`), else one per diff header (`SteppedDiffFrame`): presses go in as
 * `routePress` keeps them, and the navigation of the file they're for takes them (`takesKept`, `drainKept`). A step
 * from a file takes the presses left for it along (`retag`); presses are dropped only when the selection leaves their
 * file (`keepOnly`), so a file picked while another loads opens at its top.
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

/** A queue of presses tagged with the file they're for, and whether a view takes its own from it. */
export interface KeptPresses {
  queue: StepQueue;
  takes: boolean;
}

/**
 * Hands the presses kept for `path` to its view (`go`), once it may (`takesKept`). A press that does something is the
 * last for now: the render a move brings takes the next, from where it left the view, and a press gone on to another
 * file, or kept for one, leaves the rest to that file. A press that does nothing brings no render, so the next is taken
 * at once, never left waiting for one.
 */
export function drainKept(queue: StepQueue, path: string, go: (direction: StepDirection) => PressEffect): void {
  for (let press = queue.take(path); press !== undefined; press = queue.take(path)) {
    if (go(press) !== 'none') return;
  }
}
