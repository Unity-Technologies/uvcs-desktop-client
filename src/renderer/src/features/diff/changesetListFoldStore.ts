import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChangesetListFoldStore {
  /** The user left a branch diff's changesets open (`ChangesetListFold.remembered`). */
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** Whether branch diffs open with their changesets shown, as the user last left them, across branches and sessions. */
export const useChangesetListFoldStore = create<ChangesetListFoldStore>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (open) => set({ open }),
    }),
    { name: 'branch-diff-changesets', partialize: ({ open }) => ({ open }) },
  ),
);
