import { api } from '../../api/client';
import type { DiffEntry } from '@shared/domain/diff';
import { shownFileOf } from '../../features/diff/shownDiffFile';
import { diffEntriesKey } from '../../features/diff/useDiffEntries';
import { afterLeaving } from '../navigation/leaveGuard';
import { navigation } from '../navigation/navigationStore';
import type { Page, PageOf } from '../navigation/pages';
import { queryClient } from '../queryClient';
import { useSession } from '../workspace/sessionStore';
import { pageWindowOpening } from './movablePages';
import { pageSeed } from './pageSeeds';

/**
 * Opens a page of the open workspace in a window of its own (a menu's "Open diff in new window"), handing it what this
 * window already read of it: the diff's files, the changeset's or shelve's row.
 */
export function openInNewWindow(page: Page): void {
  const workspacePath = useSession.getState().workspacePath;
  if (!workspacePath) return;
  const seed = pageSeed(workspacePath, page);
  const opening = pageWindowOpening(workspacePath, page, (diff) => cachedDiffEntries(workspacePath, diff));
  void api.windows.openPage(seed ? { ...opening, seed } : opening);
}

/**
 * Moves the page on screen to a window of its own: it opens there, and this window goes back to what was under it
 * (the Branch Explorer it was opened from, say), once what it holds unsaved is settled.
 */
export function movePageToNewWindow(page: Page): void {
  afterLeaving(() => {
    openInNewWindow(onShownFile(page));
    navigation.goBack();
  });
}

/** A diff moves on the file the user is reading in it, not the one it opened on. */
function onShownFile(page: Page): Page {
  if (page.kind !== 'diff') return page;
  const shown = shownFileOf(page.target);
  return shown ? { ...page, focusPath: shown } : page;
}

/** The files of a diff this window already read (`useDiffEntries`'s query), at the branch head it was read at. */
function cachedDiffEntries(workspacePath: string, { target, branchHead }: PageOf<'diff'>): DiffEntry[] | undefined {
  return queryClient.getQueryData<DiffEntry[]>(diffEntriesKey(workspacePath, target, branchHead));
}
