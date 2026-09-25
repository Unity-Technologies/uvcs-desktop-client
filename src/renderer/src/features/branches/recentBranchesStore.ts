import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT = 6;

interface RecentBranchesStore {
  /** Most recently switched-to branches per workspace, newest first. */
  byWorkspace: Record<string, string[]>;
  remember: (workspacePath: string, branch: string) => void;
}

export const useRecentBranchesStore = create<RecentBranchesStore>()(
  persist(
    (set) => ({
      byWorkspace: {},
      remember: (workspacePath, branch) =>
        set((state) => {
          const recent = state.byWorkspace[workspacePath] ?? [];
          return { byWorkspace: { ...state.byWorkspace, [workspacePath]: [branch, ...recent.filter((name) => name !== branch)].slice(0, MAX_RECENT) } };
        }),
    }),
    { name: 'recent-branches' },
  ),
);

export function useRecentBranches(workspacePath: string): string[] {
  return useRecentBranchesStore((state) => state.byWorkspace[workspacePath]) ?? EMPTY;
}

const EMPTY: string[] = [];
