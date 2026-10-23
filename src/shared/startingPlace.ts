import type { PageSeed, PageWindowPage } from './domain/pageWindow';
import { repositoryPlace, workspacePlace, type Place } from './domain/place';

/**
 * A window opened for a place (`WorkspaceWindows.open`: a workspace, or a repository explored without one) names it in
 * its page's address, so the page opens it before its first render (`openPlaceFromAddress`) and never draws the home
 * screen on the way. Asking the main process instead (`system.takeRequestedWorkspace`) would put a round trip before
 * the first render, and that waits behind the window's `show()` once an empty first frame made it ready to show. A
 * window reopened after restarting to install an update names the view it showed too, which it opens on instead of
 * its first view.
 */
const WORKSPACE_PARAMETER = 'workspace';
const REPOSITORY_PARAMETER = 'repository';
const VIEW_PARAMETER = 'view';
const PAGE_PARAMETER = 'page';
const SEED_PARAMETER = 'seed';

/** The page address's query for a window opened for `place` (none for the home screen), on `view` if given. */
export function startingPlaceQuery(place: Place | undefined, view?: string): Record<string, string> {
  if (!place) return {};
  const named = placeParameter(place);
  return view ? { ...named, [VIEW_PARAMETER]: view } : named;
}

/** The place a page address's query (`location.search`) names, or null. */
export function startingPlaceIn(search: string): Place | null {
  const query = new URLSearchParams(search);
  const workspacePath = query.get(WORKSPACE_PARAMETER);
  if (workspacePath) return workspacePlace(workspacePath);
  const repository = query.get(REPOSITORY_PARAMETER);
  return repository ? repositoryPlace(repository) : null;
}

function placeParameter(place: Place): Record<string, string> {
  return place.kind === 'workspace' ? { [WORKSPACE_PARAMETER]: place.workspacePath } : { [REPOSITORY_PARAMETER]: place.repository };
}

/** The view a page address's query names (a renderer `ViewId`, unchecked), or null. */
export function startingViewIn(search: string): string | null {
  return new URLSearchParams(search).get(VIEW_PARAMETER);
}

/**
 * The page address's query for a page window (`windows.openPage`): its place and the page it shows, which the address
 * keeps, unlike a place's window's, so a reload shows the page again.
 */
export function pageWindowQuery(place: Place, page: PageWindowPage, seed?: PageSeed): Record<string, string> {
  const query = { ...placeParameter(place), [PAGE_PARAMETER]: JSON.stringify(page) };
  return seed ? { ...query, [SEED_PARAMETER]: JSON.stringify(seed) } : query;
}

/** The object a page window's address hands it (`PageSeed`, unchecked: it came from this app's own lists), or null. */
export function startingSeedIn(search: string): PageSeed | null {
  const seed = new URLSearchParams(search).get(SEED_PARAMETER);
  if (seed === null) return null;
  try {
    const parsed: unknown = JSON.parse(seed);
    return typeof parsed === 'object' && parsed !== null && typeof (parsed as { readAt?: unknown }).readAt === 'number' ? (parsed as PageSeed) : null;
  } catch {
    return null;
  }
}

/** The page a page window's address names (unchecked: the renderer's `asMovablePage` checks it), or null for any other window. */
export function startingPageIn(search: string): PageWindowPage | null {
  const page = new URLSearchParams(search).get(PAGE_PARAMETER);
  if (page === null) return null;
  try {
    const parsed: unknown = JSON.parse(page);
    return isPageLike(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isPageLike(value: unknown): value is PageWindowPage {
  return typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string';
}
