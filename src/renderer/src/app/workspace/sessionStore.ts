import { create } from 'zustand';
import { repositoryPlace, workspacePathOf, workspacePlace, type Place } from '@shared/domain/place';

interface SessionStore {
  /** What the window shows: a workspace, or a repository explored without one; null on the home screen. */
  place: Place | null;
  /** The place's workspace: null on the home screen, and while exploring a repository without one. */
  workspacePath: string | null;
  /** The workspace this window last left for the home screen, which offers the way back to it; null if none. */
  leftWorkspacePath: string | null;
  openWorkspace: (path: string) => void;
  /** Explores `repository` without a workspace (docs/features/explore-repository.md). */
  explore: (repository: string) => void;
  /** Back to the home screen, from a workspace or a repository explored. */
  goHome: () => void;
}

export const useSession = create<SessionStore>((set) => ({
  place: null,
  workspacePath: null,
  leftWorkspacePath: null,
  openWorkspace: (path) => set(showing(workspacePlace(path))),
  explore: (repository) => set(showing(repositoryPlace(repository))),
  goHome: () => set((state) => ({ ...showing(null), leftWorkspacePath: state.workspacePath ?? state.leftWorkspacePath })),
}));

function showing(place: Place | null): Pick<SessionStore, 'place' | 'workspacePath'> {
  return { place, workspacePath: place && workspacePathOf(place) };
}
