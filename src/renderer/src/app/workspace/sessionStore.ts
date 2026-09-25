import { create } from 'zustand';

interface SessionStore {
  /** The open workspace, or null while on the home screen. */
  workspacePath: string | null;
  openWorkspace: (path: string) => void;
  closeWorkspace: () => void;
}

export const useSession = create<SessionStore>((set) => ({
  workspacePath: null,
  openWorkspace: (path) => set({ workspacePath: path }),
  closeWorkspace: () => set({ workspacePath: null }),
}));
