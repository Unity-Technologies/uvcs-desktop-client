import { create } from 'zustand';
import { api } from '../../api/client';
import { replaceMergeQuestion } from '../../features/merge/mergeDescription';
import { confirm } from '../../ui/dialog/confirm';
import { routeInPageWindow, type NavigationRequest } from '../pageWindow/pageWindowRouting';
import { usePageWindow } from '../pageWindow/pageWindowStore';
import { useSession } from '../workspace/sessionStore';
import { afterLeaving } from './leaveGuard';
import { isSameMerge, mergeAfterLeaving, mergeAwaiting, pagesWithoutMerge, showsMerge, type MergeInProgress } from './mergeInProgress';
import type { Page, PageOf } from './pages';
import { viewCommandId, type ViewId } from './views';

interface NavigationStore {
  view: ViewId;
  pages: Page[];
  /** The merge being worked on, shown or set aside (`MergeInProgress`). */
  merge: MergeInProgress | null;
  goToView: (view: ViewId) => void;
  /** A merge may ask before it opens (`openOrReturnToMerge`): it resolves once it opened, or the user kept the one in progress. */
  openPage: (page: Page) => void | Promise<void>;
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
  // Pages open over the view and keep it, so only another view leaves what it shows (unsaved edits, say). A merge in
  // progress is set aside, never closed, by any of these.
  goToView: (view) => {
    if (routed({ kind: 'goToView' }, get().pages) === 'workspaceWindow') return void api.windows.showWorkspaceWindow(viewCommandId(view));
    const leave = (): void => set((state) => ({ ...(view !== state.view && { view }), pages: [], merge: mergeAfterLeaving(state.merge, state.pages) }));
    if (view === get().view) leave();
    else afterLeaving(leave);
  },
  openPage: (page) => {
    if (routed({ kind: 'openPage', page }, get().pages) === 'workspaceWindow') return void api.windows.openPageInWorkspaceWindow(page);
    if (page.kind === 'merge') return openOrReturnToMerge(page);
    set((state) => ({ pages: [...state.pages, page] }));
  },
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

/** Where a navigation goes: in a page window, as `routeInPageWindow` says; in a workspace window, always here. */
function routed(request: NavigationRequest, pages: readonly Page[]): ReturnType<typeof routeInPageWindow> {
  return usePageWindow.getState().isPageWindow ? routeInPageWindow(request, pages) : 'here';
}

/** For use outside React, e.g. from menu actions. */
export const navigation = {
  goToView: (view: ViewId) => useNavigation.getState().goToView(view),
  openPage: (page: Page): void => void useNavigation.getState().openPage(page),
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
