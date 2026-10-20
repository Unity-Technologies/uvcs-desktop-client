import { create } from 'zustand';
import type { DiffTarget } from '@shared/domain/diff';

interface ShownDiffFile {
  /** The diff on screen and the file selected in it; null while no diff shows. */
  shown: { target: DiffTarget; path: string } | null;
}

/**
 * The file the diff on screen shows (`DiffBrowser`), so moving the page to a new window opens it on that file
 * (`movePageToNewWindow`) rather than on the one it opened on.
 */
export const useShownDiffFile = create<ShownDiffFile>(() => ({ shown: null }));

/** The file shown in the diff of `target`, if that diff is the one on screen. */
export function shownFileOf(target: DiffTarget): string | undefined {
  const { shown } = useShownDiffFile.getState();
  return shown && JSON.stringify(shown.target) === JSON.stringify(target) ? shown.path : undefined;
}
