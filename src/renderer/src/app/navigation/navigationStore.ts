import { create } from 'zustand';
import { api } from '../../api/client';
import { routeInPageWindow, type NavigationRequest } from '../pageWindow/pageWindowRouting';
import { usePageWindow } from '../pageWindow/pageWindowStore';
import { afterLeaving } from './leaveGuard';
import type { Page } from './pages';
import { viewCommandId, type ViewId } from './views';

interface NavigationStore {
  view: ViewId;
  pages: Page[];
  goToView: (view: ViewId) => void;
  openPage: (page: Page) => void;
  goBack: () => void;
}

export const useNavigation = create<NavigationStore>((set, get) => ({
  view: 'changes',
  pages: [],
  // Pages open over the view and keep it, so only another view leaves what it shows (unsaved edits, say).
  goToView: (view) => {
    if (routed({ kind: 'goToView' }, get().pages) === 'workspaceWindow') return void api.windows.showWorkspaceWindow(viewCommandId(view));
    if (view === get().view) set({ pages: [] });
    else afterLeaving(() => set({ view, pages: [] }));
  },
  openPage: (page) => {
    if (routed({ kind: 'openPage', page }, get().pages) === 'workspaceWindow') return void api.windows.openPageInWorkspaceWindow(page);
    set((state) => ({ pages: [...state.pages, page] }));
  },
  goBack: () => {
    if (routed({ kind: 'goBack' }, get().pages) === 'close') return window.close();
    set((state) => ({ pages: state.pages.slice(0, -1) }));
  },
}));

/** Where a navigation goes: in a page window, as `routeInPageWindow` says; in a workspace window, always here. */
function routed(request: NavigationRequest, pages: readonly Page[]): ReturnType<typeof routeInPageWindow> {
  return usePageWindow.getState().isPageWindow ? routeInPageWindow(request, pages) : 'here';
}

/** For use outside React, e.g. from menu actions. */
export const navigation = {
  goToView: (view: ViewId) => useNavigation.getState().goToView(view),
  openPage: (page: Page) => useNavigation.getState().openPage(page),
  goBack: () => useNavigation.getState().goBack(),
};
