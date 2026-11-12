import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeletedRepositoriesStore {
  /** Whether a server's repositories show its deleted ones too, which only its administrators are listed. */
  shown: boolean;
  setShown: (shown: boolean) => void;
}

/**
 * The home screen's option to show deleted repositories, off at first and kept across sessions: an administrator who
 * restores repositories now and then turns it on when needed, and everyone else never sees it (`RepositoriesPanel`
 * offers it only when the listing holds deleted ones).
 */
export const useDeletedRepositoriesStore = create<DeletedRepositoriesStore>()(
  persist(
    (set) => ({
      shown: false,
      setShown: (shown) => set({ shown }),
    }),
    { name: 'home-deleted-repositories', partialize: ({ shown }) => ({ shown }) },
  ),
);
