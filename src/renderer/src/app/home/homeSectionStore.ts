import { create } from 'zustand';
import { WELCOME, type HomeSection } from './homeSection';

interface HomeSectionStore {
  section: HomeSection;
  show: (section: HomeSection) => void;
}

/**
 * What this window's home screen shows; a link to a server's repositories sets it too (`openLink`). Leaving the home
 * screen sets it back to the welcome (`HomeScreen`).
 */
export const useHomeSection = create<HomeSectionStore>()((set) => ({
  section: WELCOME,
  show: (section) => set({ section }),
}));
