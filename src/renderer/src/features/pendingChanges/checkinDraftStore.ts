import { create } from 'zustand';

interface CheckinDraft {
  summary: string;
  description: string;
  /** Paths the user unchecked. New changes are included by default, so we remember exclusions. */
  excludedPaths: ReadonlySet<string>;
}

const EMPTY_DRAFT: CheckinDraft = { summary: '', description: '', excludedPaths: new Set() };

interface CheckinDraftStore {
  drafts: Record<string, CheckinDraft>;
  setMessage: (workspacePath: string, message: { summary?: string; description?: string }) => void;
  setIncluded: (workspacePath: string, paths: string[], included: boolean) => void;
  /** After a check-in: the comment goes, the files left out stay left out. */
  clearMessage: (workspacePath: string) => void;
}

/** The checkin comment and file selection, kept per workspace while the user moves between views. */
export const useCheckinDraftStore = create<CheckinDraftStore>((set) => {
  const updateDraft = (workspacePath: string, update: (draft: CheckinDraft) => CheckinDraft) =>
    set((state) => ({ drafts: { ...state.drafts, [workspacePath]: update(state.drafts[workspacePath] ?? EMPTY_DRAFT) } }));

  return {
    drafts: {},
    setMessage: (workspacePath, message) => updateDraft(workspacePath, (draft) => ({ ...draft, ...message })),
    setIncluded: (workspacePath, paths, included) =>
      updateDraft(workspacePath, (draft) => {
        const excludedPaths = new Set(draft.excludedPaths);
        paths.forEach((path) => (included ? excludedPaths.delete(path) : excludedPaths.add(path)));
        return { ...draft, excludedPaths };
      }),
    clearMessage: (workspacePath) => updateDraft(workspacePath, (draft) => ({ ...draft, summary: '', description: '' })),
  };
});

/** The draft as it is now, for what reads it once (checking in) rather than showing it. */
export function checkinDraftOf(workspacePath: string): CheckinDraft {
  return useCheckinDraftStore.getState().drafts[workspacePath] ?? EMPTY_DRAFT;
}

/** The comment alone: typing it renders only what shows it, not the list of changes. */
export function useCheckinMessage(workspacePath: string): { summary: string; description: string } {
  const summary = useCheckinDraftStore((state) => (state.drafts[workspacePath] ?? EMPTY_DRAFT).summary);
  const description = useCheckinDraftStore((state) => (state.drafts[workspacePath] ?? EMPTY_DRAFT).description);
  return { summary, description };
}

export function useExcludedPaths(workspacePath: string): ReadonlySet<string> {
  return useCheckinDraftStore((state) => (state.drafts[workspacePath] ?? EMPTY_DRAFT).excludedPaths);
}
