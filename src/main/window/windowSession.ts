import type { SavedWindow } from '@shared/domain/settings';

/**
 * The windows to open again at launch, of those open when the app last quit (`openWindows`): one per workspace or
 * repository explored without one, and none for a workspace whose folder is gone (the home screen or another window
 * shows the rest). The focused one stays last, so it opens last and keeps the focus.
 */
export function windowsToReopen(saved: readonly SavedWindow[], folderExists: (path: string) => boolean): SavedWindow[] {
  const reopened: SavedWindow[] = [];
  // From the focused one back, so a place saved twice reopens where it was focused.
  for (const window of [...saved].reverse()) {
    const { workspacePath } = window;
    if (workspacePath && !folderExists(workspacePath)) continue;
    if (savesAPlace(window) && reopened.some((other) => samePlaceSaved(other, window))) continue;
    reopened.unshift(window);
  }
  return reopened;
}

function savesAPlace({ workspacePath, repository }: SavedWindow): boolean {
  return Boolean(workspacePath || repository);
}

function samePlaceSaved(a: SavedWindow, b: SavedWindow): boolean {
  return (a.workspacePath ?? '') === (b.workspacePath ?? '') && (a.repository ?? '') === (b.repository ?? '');
}

/** The windows to save, in the order they were opened, with the focused one moved last. */
export function inSessionOrder<T>(windows: readonly T[], focused: T | null): T[] {
  if (!focused || !windows.includes(focused)) return [...windows];
  return [...windows.filter((window) => window !== focused), focused];
}
