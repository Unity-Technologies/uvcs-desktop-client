import { create } from 'zustand';

interface CommandPaletteStore {
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  toggle: () => void;
}

export const useCommandPalette = create<CommandPaletteStore>((set) => ({
  isOpen: false,
  setOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
