import { create } from 'zustand';
import type { ChosenBranch } from './repositoryFilesBody';

interface RepositoryFilesStore {
  /** The branch each repository's Files view shows, by repository spec, as the user picked it this session. */
  chosenBranches: Readonly<Record<string, ChosenBranch>>;
  choose: (repository: string, branch: ChosenBranch) => void;
  /** Back to the main branch: the one picked is gone (`repositoryFilesBodyOf`'s `chosenGone`). */
  forget: (repository: string) => void;
}

/** The Files view's branch of each repository explored without a workspace, kept while the window lives (`filesBranchToRead`). */
export const useRepositoryFilesStore = create<RepositoryFilesStore>((set) => ({
  chosenBranches: {},
  choose: (repository, branch) => set((state) => ({ chosenBranches: { ...state.chosenBranches, [repository]: branch } })),
  forget: (repository) =>
    set((state) => {
      const { [repository]: _forgotten, ...others } = state.chosenBranches;
      return { chosenBranches: others };
    }),
}));
