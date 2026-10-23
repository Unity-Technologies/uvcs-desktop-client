import { create } from 'zustand';

interface RepositoryFilesStore {
  /** The branch each repository's Files view shows, by repository spec, as the user chose it this session. */
  chosenBranches: Readonly<Record<string, string>>;
  choose: (repository: string, branch: string) => void;
}

/** The Files view's branch of each repository explored without a workspace, kept while the window lives (`shownFilesBranch`). */
export const useRepositoryFilesStore = create<RepositoryFilesStore>((set) => ({
  chosenBranches: {},
  choose: (repository, branch) => set((state) => ({ chosenBranches: { ...state.chosenBranches, [repository]: branch } })),
}));
