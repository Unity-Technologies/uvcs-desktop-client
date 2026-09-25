import { create } from 'zustand';

interface CheckinDraft {
  comment: string;
  /** Paths the user unchecked. New changes are included by default, so we remember exclusions. */
  excludedPaths: ReadonlySet<string>;
}

const EMPTY_DRAFT: CheckinDraft = { comment: '', excludedPaths: new Set() };

interface CheckinDraftStore {
  drafts: Record<string, CheckinDraft>;
  setComment: (workspacePath: string, comment: string) => void;
  setIncluded: (workspacePath: string, paths: string[], included: boolean) => void;
  reset: (workspacePath: string) => void;
}

/** The checkin comment and file selection, kept per workspace while the user moves between views. */
export const useCheckinDraftStore = create<CheckinDraftStore>((set) => {
  const updateDraft = (workspacePath: string, update: (draft: CheckinDraft) => CheckinDraft) =>
    set((state) => ({ drafts: { ...state.drafts, [workspacePath]: update(state.drafts[workspacePath] ?? EMPTY_DRAFT) } }));

  return {
    drafts: {},
    setComment: (workspacePath, comment) => updateDraft(workspacePath, (draft) => ({ ...draft, comment })),
    setIncluded: (workspacePath, paths, included) =>
      updateDraft(workspacePath, (draft) => {
        const excludedPaths = new Set(draft.excludedPaths);
        paths.forEach((path) => (included ? excludedPaths.delete(path) : excludedPaths.add(path)));
        return { ...draft, excludedPaths };
      }),
    reset: (workspacePath) => updateDraft(workspacePath, () => EMPTY_DRAFT),
  };
});

export function useCheckinDraft(workspacePath: string): CheckinDraft {
  return useCheckinDraftStore((state) => state.drafts[workspacePath] ?? EMPTY_DRAFT);
}
