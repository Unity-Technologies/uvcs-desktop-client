import { create } from 'zustand';

interface PageWindowStore {
  /**
   * This window is a page window (`openPageWindowFromAddress`): it shows one page of its workspace (a diff, a
   * history…) without the workspace's views, beside the workspace window that opened it.
   */
  isPageWindow: boolean;
  /** This page window shows what is selected in its workspace window (`followingChanged`). */
  following: boolean;
  /** A workspace window: one of its page windows follows its selection (`selectionFollowed`). */
  followed: boolean;
}

export const usePageWindow = create<PageWindowStore>(() => ({ isPageWindow: false, following: false, followed: false }));
