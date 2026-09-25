import { create } from 'zustand';

interface BranchSwitcherStore {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

/** Lets commands (e.g. from the palette) open the branch switcher in the top bar. */
export const useBranchSwitcher = create<BranchSwitcherStore>((set) => ({
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
}));
