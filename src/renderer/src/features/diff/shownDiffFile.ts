import { create } from 'zustand';
import type { DiffTarget } from '@shared/domain/diff';

/** The diff on screen and the file selected in it. */
export interface ShownDiffFileOf {
  target: DiffTarget;
  path: string;
}

interface ShownDiffFile {
  /** Null while no diff shows. */
  shown: ShownDiffFileOf | null;
}

/**
 * The file the diff on screen shows (`DiffBrowser`), so moving the page to a new window opens it on that file
 * (`movePageToNewWindow`) rather than on the one it opened on.
 */
export const useShownDiffFile = create<ShownDiffFile>(() => ({ shown: null }));

/** Whether two files shown are the same, by what their diffs compare, not by object: a diff may pass a new target each render. */
export function sameShownFile(a: ShownDiffFileOf | null, b: ShownDiffFileOf | null): boolean {
  if (a === null || b === null) return a === b;
  return a.path === b.path && JSON.stringify(a.target) === JSON.stringify(b.target);
}

/**
 * Says which file the diff on screen shows, only when it changes: what listens (Copy link, in the page's header)
 * renders the page again, which would publish again and again otherwise.
 */
export function publishShownDiffFile(shown: ShownDiffFileOf | null): void {
  if (!sameShownFile(useShownDiffFile.getState().shown, shown)) useShownDiffFile.setState({ shown });
}

/** The file shown in the diff of `target`, if that diff is the one on screen. */
export function shownFileOf(target: DiffTarget): string | undefined {
  const { shown } = useShownDiffFile.getState();
  return shown && sameShownFile(shown, { target, path: shown.path }) ? shown.path : undefined;
}
