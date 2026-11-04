import { createContext, useMemo, useRef } from 'react';

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
  /** Selects that file, its diff to open at its first or last change. */
  step: (direction: 1 | -1) => void;
  /** Where the diff of `path` opens, once: after a step to it, else nowhere in particular. */
  takeArrival: (path: string) => Arrival | null;
  /**
   * The file a step went to whose diff hasn't taken its arrival yet, while the list is still on it: the diff shown is
   * still the previous file's (the selection settling, the file read), and a press meanwhile is meant for that file.
   */
  steppingTo: () => string | null;
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
  /** Selects a file, as the list does (asking first about unsaved edits: `selectAfterLeaving`). */
  select: (key: string) => void;
  pathOf: (key: string) => string;
  /**
   * Where a step leaves the arrival of the file it goes to (`usePendingArrival`), shared by the lists of one view whose
   * files open under either (Incoming's diffs and conflicts): the file stepped to takes it, whichever list it shows in.
   */
  pending?: PendingArrivalRef;
}

/** Where a step leaves the arrival of the file it selects, until that file's view takes it. */
export type PendingArrivalRef = { current: PendingArrival | null };

/** One pending arrival, to share between the file steps of one view (`FileStepsOptions.pending`). */
export function usePendingArrival(): PendingArrivalRef {
  return useRef<PendingArrival | null>(null);
}

/** A step to a file whose diff hasn't opened yet: where it opens. */
export interface PendingArrival {
  path: string;
  at: Arrival;
}

/**
 * Steps through `keys` from `current` for the diff beside them: a step selects the file after or before (going on
 * from the diff's last or first change) and leaves in `pending` where its diff opens, taken once by that diff.
 */
export function fileSteps(
  keys: readonly string[],
  current: string | null,
  list: Pick<FileStepsOptions, 'select' | 'pathOf'>,
  pending: PendingArrivalRef,
): FileSteps {
  return {
    canStep: (direction) => adjacentKey(keys, current, direction) !== null,
    step: (direction) => {
      const key = adjacentKey(keys, current, direction);
      if (key === null) return;
      pending.current = { path: list.pathOf(key), at: direction === 1 ? 'first' : 'last' };
      list.select(key);
    },
    takeArrival: (path) => {
      const at = pending.current?.path === path ? pending.current.at : null;
      if (at) pending.current = null;
      return at;
    },
    steppingTo: () => {
      const path = pending.current?.path ?? null;
      return path !== null && current !== null && list.pathOf(current) === path ? path : null;
    },
  };
}

/** Steps through a list's files for the diff beside it. */
export function useFileSteps({ keys, current, select, pathOf, pending }: FileStepsOptions): FileSteps {
  const ownArrival = usePendingArrival();
  const arrival = pending ?? ownArrival;
  const latest = useRef({ select, pathOf });
  latest.current = { select, pathOf };
  return useMemo(
    () => fileSteps(keys, current, { select: (key) => latest.current.select(key), pathOf: (key) => latest.current.pathOf(key) }, arrival),
    [keys, current, arrival],
  );
}
