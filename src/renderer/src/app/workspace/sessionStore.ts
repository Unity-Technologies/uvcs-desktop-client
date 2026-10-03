import { create } from 'zustand';

interface SessionStore {
  /** The open workspace, or null while on the home screen. */
  workspacePath: string | null;
  /** The workspace this window last left for the home screen, which offers the way back to it; null if none. */
  leftWorkspacePath: string | null;
  openWorkspace: (path: string) => void;
  closeWorkspace: () => void;
}

export const useSession = create<SessionStore>((set) => ({
  workspacePath: null,
  leftWorkspacePath: null,
  openWorkspace: (path) => set({ workspacePath: path }),
  closeWorkspace: () => set((state) => ({ workspacePath: null, leftWorkspacePath: state.workspacePath ?? state.leftWorkspacePath })),
}));
