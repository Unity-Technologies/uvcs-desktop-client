import { beforeEach } from 'vitest';
import { queryKeys } from '../api/queryKeys';
import { useNavigation } from '../app/navigation/navigationStore';
import type { Page } from '../app/navigation/pages';
import type { ViewId } from '../app/navigation/views';
import { queryClient } from '../app/queryClient';
import { useToastStore, type ToastKind } from '../ui/toast/toastStore';

/**
 * What an operation left for the user to see: the toasts, where the window went, and which views it refreshed.
 * Import `./fakeWindow` first. Each test starts with no toasts, on Changes with no pages, and no queries.
 */

/** Every area a workspace query key names (`queryKeys.inWorkspace(path, area, ...)`). */
const WORKSPACE_AREAS = [
  'annotate',
  'attributeTypes',
  'attributeUsedValues',
  'attributeValues',
  'branchExplorer',
  'branches',
  'changesets',
  'codeReviews',
  'explorer',
  'history',
  'incoming',
  'info',
  'labels',
  'leftChanges',
  'locks',
  'pendingChanges',
  'review',
  'shelves',
] as const;

export type WorkspaceArea = (typeof WORKSPACE_AREAS)[number];

/**
 * Seeds a query of every area of the workspace, then tells which ones were refreshed since (invalidated by
 * `invalidateWorkspace`, as an operation's `affects` asked), sorted.
 */
export function watchRefreshes(workspacePath: string): () => WorkspaceArea[] {
  const keyOf = (area: WorkspaceArea) => queryKeys.inWorkspace(workspacePath, area, ...(AREA_DETAILS[area] ?? []));
  for (const area of WORKSPACE_AREAS) queryClient.setQueryData(keyOf(area), 'read');
  return () => WORKSPACE_AREAS.filter((area) => queryClient.getQueryState(keyOf(area))?.isInvalidated);
}

/** The rest of the key of an area whose refreshes go by it: the Files view's listing of the workspace root. */
const AREA_DETAILS: Partial<Record<WorkspaceArea, unknown[]>> = { explorer: ['directory', ''] };

export interface ShownToast {
  kind: ToastKind;
  title: string;
  detail?: string;
  action?: string;
}

/** The toasts on screen, without the fields a user doesn't see. */
export function shownToasts(): ShownToast[] {
  return useToastStore.getState().toasts.map(({ kind, title, detail, action }) => ({
    kind,
    title,
    ...(detail !== undefined && { detail }),
    ...(action && { action: action.label }),
  }));
}

/** Runs the action of the toast titled `title`. */
export function pressToastAction(title: string): void {
  const shown = useToastStore.getState().toasts.find((toast) => toast.title === title);
  if (!shown?.action) throw new Error(`No toast "${title}" with an action`);
  shown.action.run();
}

/** The view the window shows and the pages open over it. */
export function whereTheWindowIs(): { view: ViewId; pages: Page[] } {
  const { view, pages } = useNavigation.getState();
  return { view, pages };
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  useNavigation.setState({ view: 'changes', pages: [] });
  queryClient.clear();
});
