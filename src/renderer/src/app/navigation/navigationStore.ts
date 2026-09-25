import { create } from 'zustand';
import { afterLeaving } from './leaveGuard';
import type { Page } from './pages';
import type { ViewId } from './views';

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
  goToView: (view) => (view === get().view ? set({ pages: [] }) : afterLeaving(() => set({ view, pages: [] }))),
  openPage: (page) => set((state) => ({ pages: [...state.pages, page] })),
  goBack: () => set((state) => ({ pages: state.pages.slice(0, -1) })),
}));

/** For use outside React, e.g. from menu actions. */
export const navigation = {
  goToView: (view: ViewId) => useNavigation.getState().goToView(view),
  openPage: (page: Page) => useNavigation.getState().openPage(page),
  goBack: () => useNavigation.getState().goBack(),
};
