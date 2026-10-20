import { api } from '../../api/client';
import type { DiffEntry } from '@shared/domain/diff';
import { diffEntriesKey } from '../../features/diff/useDiffEntries';
import { afterLeaving } from '../navigation/leaveGuard';
import { navigation } from '../navigation/navigationStore';
import type { Page, PageOf } from '../navigation/pages';
import { queryClient } from '../queryClient';
import { useSession } from '../workspace/sessionStore';
import { pageWindowOpening } from './movablePages';

/** Opens a page of the open workspace in a window of its own (a menu's "Open diff in new window"). */
export function openInNewWindow(page: Page): void {
  const workspacePath = useSession.getState().workspacePath;
  if (!workspacePath) return;
  void api.windows.openPage(pageWindowOpening(workspacePath, page, (diff) => cachedDiffEntries(workspacePath, diff)));
}

/**
 * Moves the page on screen to a window of its own: it opens there, and this window goes back to what was under it
 * (the Branch Explorer it was opened from, say), once what it holds unsaved is settled.
 */
export function movePageToNewWindow(page: Page): void {
  afterLeaving(() => {
    openInNewWindow(page);
    navigation.goBack();
  });
}

/** The files of a diff this window already read (`useDiffEntries`'s query), at the branch head it was read at. */
function cachedDiffEntries(workspacePath: string, { target, branchHead }: PageOf<'diff'>): DiffEntry[] | undefined {
  return queryClient.getQueryData<DiffEntry[]>(diffEntriesKey(workspacePath, target, branchHead));
}
