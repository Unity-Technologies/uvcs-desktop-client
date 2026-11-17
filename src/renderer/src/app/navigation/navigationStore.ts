import { create } from 'zustand';
import { api } from '../../api/client';
import { replaceMergeQuestion } from '../../features/merge/mergeDescription';
import { confirm } from '../../ui/dialog/confirm';
import { routeInPageWindow, type NavigationRequest } from '../pageWindow/pageWindowRouting';
import { usePageWindow } from '../pageWindow/pageWindowStore';
import { useSession } from '../workspace/sessionStore';
import { afterLeaving } from './leaveGuard';
import { samePlace, type Place } from '@shared/domain/place';
import { NO_KEPT_VIEWS, switchedViews, type KeptViews, type ViewSwitch } from './keptViews';
import { isSameMerge, mergeAfterLeaving, mergeAwaiting, pagesWithoutMerge, showsMerge, type MergeInProgress } from './mergeInProgress';
import { movesWithinTop } from './pageMoves';
import type { Page, PageOf } from './pages';
import { viewCommandId, type ViewId } from './views';

interface NavigationStore {
  view: ViewId;
  pages: Page[];
  /** The merge being worked on, shown or set aside (`MergeInProgress`). */
  merge: MergeInProgress | null;
  /** Where the user left the place's other views (`KeptViews`). */
  kept: KeptViews;
  /**
   * Shows the view's list, closing the pages it was left with: where a link, a button or a toast leads ("View
   * changes", "Show in Locks"), which shows something in the list. The view left keeps its pages.
   */
  goToView: (view: ViewId) => void;
  /**
   * Shows the view as the user left it, its pages over it: what the sidebar and the view's shortcut do. The view
   * shown goes back to its list, as clicking its entry again says.
   */
  returnToView: (view: ViewId) => void;
  /**
   * Stacks `page` over the one on top, or shows it in its place when it's a place in that page (`movesWithinTop`). A
   * merge may ask before it opens (`openOrReturnToMerge`): it resolves once it opened, or the user kept the one in progress.
   */
  openPage: (page: Page) => void | Promise<void>;
  /** Shows `page` in place of the one on top, as a page moving within itself does (a review's tab): Back skips it. */
  replacePage: (page: Page) => void;
  goBack: () => void;
  /** Shows the merge in progress again, over the view shown. */
  returnToMerge: () => void;
  /** Ends the merge `id`, if it is still the one in progress: its page closes, with the pages opened on top of it. */
  closeMerge: (id: number) => void;
  /** The merge `id` has nothing left to keep (`MergeInProgress.settled`). */
  settleMerge: (id: number) => void;
}

let lastMergeId = 0;

export const useNavigation = create<NavigationStore>((set, get) => ({
  view: 'changes',
  pages: [],
  merge: null,
  kept: NO_KEPT_VIEWS,
  goToView: (view) => switchView(view, 'list'),
  returnToView: (view) => switchView(view, 'asLeft'),
  openPage: (page) => {
    if (routed({ kind: 'openPage', page }, get().pages) === 'workspaceWindow') return void api.windows.openPageInWorkspaceWindow(page);
    if (page.kind === 'merge') return openOrReturnToMerge(page);
    set((state) => ({ pages: movesWithinTop(state.pages.at(-1), page) ? [...state.pages.slice(0, -1), page] : [...state.pages, page] }));
  },
  replacePage: (page) => set((state) => ({ pages: [...state.pages.slice(0, -1), page] })),
  goBack: () => {
    if (routed({ kind: 'goBack' }, get().pages) === 'close') return window.close();
    set((state) => ({ pages: state.pages.slice(0, -1), merge: mergeAfterLeaving(state.merge, state.pages) }));
  },
  returnToMerge: () => {
    if (!get().merge) return;
    afterLeaving(() => set((state) => (state.merge ? { pages: [state.merge.page] } : {})));
  },
  closeMerge: (id) => set((state) => (state.merge?.id === id ? { pages: pagesWithoutMerge(state.merge, state.pages), merge: null } : {})),
  settleMerge: (id) => set((state) => (state.merge?.id === id ? { merge: { ...state.merge, settled: true } } : {})),
}));

/**
 * Pages open over the view and keep it, so only another view leaves what it shows: unsaved edits are settled first
 * (`afterLeaving`), as a view kept mounted never holds them. A merge in progress is set aside, never closed, and kept
 * with no view: the pages the view keeps are those under it (`pagesWithoutMerge`).
 */
function switchView(view: ViewId, shows: ViewSwitch['shows']): void {
  const { pages } = useNavigation.getState();
  if (routed({ kind: 'goToView' }, pages) === 'workspaceWindow') return void api.windows.showWorkspaceWindow(viewCommandId(view));
  const leave = (): void =>
    useNavigation.setState((state) => ({
      ...(view !== state.view && { view }),
      ...switchedViews(state.kept, { from: state.view, pages: pagesWithoutMerge(state.merge, state.pages), to: view, shows }),
      merge: mergeAfterLeaving(state.merge, state.pages),
    }));
  if (view === useNavigation.getState().view) leave();
  else afterLeaving(leave);
}

/**
 * Opens a merge's page. The same merge as the one in progress goes back to it, as it stands; another one replaces it
 * once the user agrees to drop it, since only one merge is worked on at a time.
 */
async function openOrReturnToMerge(page: PageOf<'merge'>): Promise<void> {
  const awaiting = mergeAwaiting(useNavigation.getState().merge);
  if (awaiting && isSameMerge(awaiting, page)) return useNavigation.getState().returnToMerge();
  if (awaiting && !(await confirm({ ...replaceMergeQuestion(awaiting.page.request), danger: true }))) return;
  useNavigation.setState((state) => ({
    pages: [...pagesWithoutMerge(state.merge, state.pages), page],
    merge: { id: ++lastMergeId, page, workspacePath: useSession.getState().workspacePath, settled: false },
  }));
}

// A merge belongs to its workspace: the screen holding it closes when the window leaves the workspace.
useSession.subscribe(({ workspacePath }) => {
  const { merge } = useNavigation.getState();
  if (merge && merge.workspacePath !== workspacePath) useNavigation.getState().closeMerge(merge.id);
});

// The views keep their pages for their place only: another place opening forgets them. The home screen between two
// visits of one place keeps them, as it keeps the place's view and pages.
let keptFor: Place | null = null;
useSession.subscribe(({ place }) => {
  if (!place || (keptFor && samePlace(keptFor, place))) return;
  keptFor = place;
  useNavigation.setState({ kept: NO_KEPT_VIEWS });
});

/** Where a navigation goes: in a page window, as `routeInPageWindow` says; in a workspace window, always here. */
function routed(request: NavigationRequest, pages: readonly Page[]): ReturnType<typeof routeInPageWindow> {
  return usePageWindow.getState().isPageWindow ? routeInPageWindow(request, pages) : 'here';
}

/** For use outside React, e.g. from menu actions. */
export const navigation = {
  goToView: (view: ViewId) => useNavigation.getState().goToView(view),
  returnToView: (view: ViewId) => useNavigation.getState().returnToView(view),
  openPage: (page: Page): void => void useNavigation.getState().openPage(page),
  replacePage: (page: Page) => useNavigation.getState().replacePage(page),
  goBack: () => useNavigation.getState().goBack(),
  returnToMerge: () => useNavigation.getState().returnToMerge(),
  closeMerge: (id: number) => useNavigation.getState().closeMerge(id),
  settleMerge: (id: number) => useNavigation.getState().settleMerge(id),
};

/** The merge in progress shown on screen, if it is: what the merge page's own actions end or settle. */
export function shownMergeId(): number | undefined {
  const { merge, pages } = useNavigation.getState();
  return showsMerge(merge, pages) ? merge!.id : undefined;
}
