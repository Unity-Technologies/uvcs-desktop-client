import type { Place } from '@shared/domain/place';
import type { Page } from './pages';

export const VIEW_IDS = [
  'changes',
  'incoming',
  'files',
  'changesets',
  'branchExplorer',
  'branches',
  'labels',
  'shelves',
  'attributes',
  'codeReviews',
  'locks',
  'sync',
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

/**
 * The views only a workspace has: its pending changes, what comes into it and syncing it. A repository explored
 * without a workspace shows every other one, each at its usual place and shortcut; its Files are a branch's latest
 * tree (`RepositoryFilesView`) where a workspace's are its disk.
 */
const WORKSPACE_VIEWS: readonly ViewId[] = ['changes', 'incoming', 'sync'];

/** Whether the place shows the view. */
export function showsView(place: Place, view: ViewId): boolean {
  return place.kind === 'workspace' || !WORKSPACE_VIEWS.includes(view);
}

/** The view a place opens on: a workspace's changes, a repository's Branch Explorer, its history at a glance. */
export function firstViewOf(place: Place): ViewId {
  return place.kind === 'workspace' ? 'changes' : 'branchExplorer';
}

/** Whether `value`, read from outside the page (its address), names a view. */
export function isViewId(value: string): value is ViewId {
  return (VIEW_IDS as readonly string[]).includes(value);
}

/**
 * The command that goes to a view (⌘1…, the palette, the menu bar). A page window sends it to its workspace window
 * by this id (`windows.showWorkspaceWindow`), which runs it as its own.
 */
export function viewCommandId(view: ViewId): string {
  return `goto.${view}`;
}

/**
 * Whether the place shows the page: every page but the merge page, a workspace's (it merges into the workspace's
 * files), which a repository explored without one never offers; one reaching it anyway says why, never fails.
 */
export function showsPage(place: Place, page: Pick<Page, 'kind'>): boolean {
  return place.kind === 'workspace' || page.kind !== 'merge';
}
