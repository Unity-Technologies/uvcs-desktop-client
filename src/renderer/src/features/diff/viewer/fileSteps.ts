import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { StepQueue } from './stepQueue';

/** Where a view opens after a step from the file beside it: at its first step going down, its last going up. */
export type Arrival = 'first' | 'last';

/**
 * The files of the list beside a view (a diff, a conflicting file), for its navigation to go on past the first and last
 * step (a change, a conflict), as the official client does (`useStepNavigation`). A list offers it around the view
 * (`FileStepsContext`).
 */
export interface FileSteps {
  /** Whether the list has a file after (1) or before (-1) the one shown. */
  canStep: (direction: 1 | -1) => boolean;
  /**
   * Selects that file, its diff to open at its first or last change; its path, or none past the ends or where the list
   * didn't select it at once (unsaved edits asked about, or kept).
   */
  step: (direction: 1 | -1) => string | null;
  /** Where the diff of `path` opens, once: after a step to it, else nowhere in particular. */
  takeArrival: (path: string) => Arrival | null;
  /**
   * The file a step went to whose diff hasn't taken its arrival yet, while the list is still on it: the diff shown is
   * still the previous file's (the selection settling, the file read), and a press meanwhile is meant for that file.
   * Also while the list hasn't rendered on it yet: a press faster than that sees the list on the file the step left.
   */
  steppingTo: () => string | null;
  /**
   * The file the list is on while the view beside it still shows another, as its host says (`FileStepsOptions.settlingOn`):
   * a press meanwhile is meant for it.
   */
  settlingOn: string | null;
  /**
   * The presses kept for files whose view hasn't taken them yet (`StepQueue`), shared by the lists of one view with
   * their pending arrival: a step from an Incoming diff into a conflicting file hands that file's view the presses left.
   */
  kept: StepQueue;
  /**
   * The list rendered on another file: drops the presses kept for the files it left (all but those of the file it is
   * on, or a step is on its way to), and forgets where a step to this file came from, so a click back there is a pick.
   */
  listMoved: () => void;
}

export const FileStepsContext = createContext<FileSteps | null>(null);

/** The key after (1) or before (-1) `current` among `keys`; none past the ends or when `current` isn't there. */
export function adjacentKey(keys: readonly string[], current: string | null, direction: 1 | -1): string | null {
  const index = current === null ? -1 : keys.indexOf(current);
  return index === -1 ? null : (keys[index + direction] ?? null);
}

interface FileStepsOptions {
  /** The files' keys in the order the list shows them. */
  keys: readonly string[];
  /** The file shown. */
  current: string | null;
  /**
   * Selects a file, as the list does, asking first about unsaved edits (`selectAfterLeaving`); calls `selected` as it
   * does, now or once the user lets the file go, and never when they keep it (Cancel).
   */
  select: (key: string, selected: () => void) => void;
  pathOf: (key: string) => string;
  /**
   * The file the list is on (its path) while the view beside it still shows another: Changes' diff follows the
   * selection once it settles (`useSettledValue`), so a click on a file leaves the previous one's diff on screen a while.
   * Compared by the host from its own two values, the change selected and the one diffed, never from paths a view shows
   * (a `.meta` shown in place of its asset).
   */
  settlingOn?: string | null;
  /**
   * Where a step leaves the arrival of the file it goes to (`usePendingArrival`), shared by the lists of one view whose
   * files open under either (Incoming's diffs and conflicts): the file stepped to takes it, whichever list it shows in.
   */
  pending?: PendingArrivalRef;
}

/** Where a step leaves the arrival of the file it selects, and the presses kept for it, until that file's view takes them. */
export interface PendingArrivalRef {
  current: PendingArrival | null;
  readonly kept: StepQueue;
}

/** No step pending, no press kept. */
export function pendingArrival(): PendingArrivalRef {
  return { current: null, kept: new StepQueue() };
}

/** One pending arrival, to share between the file steps of one view (`FileStepsOptions.pending`). */
export function usePendingArrival(): PendingArrivalRef {
  const [pending] = useState(pendingArrival);
  return pending;
}

/** A step to a file whose diff hasn't opened yet: where it opens. */
export interface PendingArrival {
  path: string;
  at: Arrival;
  /** The file the step left, until the list rendered on the one it went to (`FileSteps.listMoved`). */
  from: string | null;
}

/**
 * Steps through `keys` from `current` for the diff beside them: a step selects the file after or before (going on
 * from the diff's last or first change) and leaves in `pending` where its diff opens, taken once by that diff.
 */
export function fileSteps(
  keys: readonly string[],
  current: string | null,
  list: Pick<FileStepsOptions, 'select' | 'pathOf' | 'settlingOn'>,
  pending: PendingArrivalRef,
): FileSteps {
  return {
    canStep: (direction) => adjacentKey(keys, current, direction) !== null,
    step: (direction) => {
      const key = adjacentKey(keys, current, direction);
      if (key === null) return null;
      const path = list.pathOf(key);
      const from = list.pathOf(current!);
      // Recorded only as the list selects: a step kept back by unsaved edits leaves nothing in flight.
      let selected = false;
      list.select(key, () => {
        selected = true;
        pending.current = { path, at: direction === 1 ? 'first' : 'last', from };
      });
      return selected ? path : null;
    },
    takeArrival: (path) => {
      const at = pending.current?.path === path ? pending.current.at : null;
      if (at) pending.current = null;
      return at;
    },
    steppingTo,
    settlingOn: list.settlingOn ?? null,
    kept: pending.kept,
    listMoved: () => {
      const shown = current === null ? null : list.pathOf(current);
      const step = pending.current;
      // On a file the step neither went to nor came from (picked with a click): it's over, its arrival unwanted.
      if (step && shown !== step.path && shown !== step.from) pending.current = null;
      pending.kept.keepOnly([shown, steppingTo()]);
      if (pending.current && pending.current.path === shown) pending.current = { ...pending.current, from: null };
    },
  };

  function steppingTo(): string | null {
    const step = pending.current;
    if (step === null || current === null) return null;
    const shown = list.pathOf(current);
    return shown === step.path || shown === step.from ? step.path : null;
  }
}

/** A list's selection made at once, nothing to ask first: the step it's for is told (`FileStepsOptions.select`). */
export function selectNow(selected: () => void, select: () => void): void {
  selected();
  select();
}

/** Steps through a list's files for the diff beside it. */
export function useFileSteps({ keys, current, select, pathOf, settlingOn = null, pending }: FileStepsOptions): FileSteps {
  const ownArrival = usePendingArrival();
  const arrival = pending ?? ownArrival;
  const latest = useRef({ select, pathOf });
  latest.current = { select, pathOf };
  const steps = useMemo(
    () => fileSteps(keys, current, { select: (key, selected) => latest.current.select(key, selected), pathOf: (key) => latest.current.pathOf(key), settlingOn }, arrival),
    [keys, current, settlingOn, arrival],
  );
  // The list moved: what was kept for the files it left goes (a file picked while another loads opens at its top), for
  // every view beside it, those with no diff header too (Incoming's conflicts, an xlink). Only when it moves
  // (`[current]`): `steps` changes with the keys and the host's settling too, which leave no file behind.
  useEffect(() => steps.listMoved(), [current]);
  return steps;
}
