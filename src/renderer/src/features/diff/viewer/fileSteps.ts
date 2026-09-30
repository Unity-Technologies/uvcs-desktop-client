import { createContext, useMemo, useRef } from 'react';

/** Where a diff opens after a step from the file beside it: at its first change going down, its last going up. */
export type Arrival = 'first' | 'last';

/**
 * The files of the list beside a diff, for its change navigation to go on past the first and last change, as the
 * official client does (`useChangeNavigation`). A list offers it around its diff (`FileStepsContext`).
 */
export interface FileSteps {
  /** Whether the list has a file after (1) or before (-1) the one shown. */
  canStep: (direction: 1 | -1) => boolean;
  /** Selects that file, its diff to open at its first or last change. */
  step: (direction: 1 | -1) => void;
  /** Where the diff of `path` opens, once: after a step to it, else nowhere in particular. */
  takeArrival: (path: string) => Arrival | null;
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
  pending: { current: PendingArrival | null },
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
  };
}

/** Steps through a list's files for the diff beside it. */
export function useFileSteps({ keys, current, select, pathOf }: FileStepsOptions): FileSteps {
  const arrival = useRef<PendingArrival | null>(null);
  const latest = useRef({ select, pathOf });
  latest.current = { select, pathOf };
  return useMemo(
    () => fileSteps(keys, current, { select: (key) => latest.current.select(key), pathOf: (key) => latest.current.pathOf(key) }, arrival),
    [keys, current],
  );
}
