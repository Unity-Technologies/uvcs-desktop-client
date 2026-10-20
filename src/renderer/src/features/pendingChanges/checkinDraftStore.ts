import { useMemo } from 'react';
import { create } from 'zustand';
import { withEverythingIncluded, withIncluded, type CheckinChoice, type PreparedChangelist } from './checkinSelection';

interface CheckinDraft extends CheckinChoice {
  summary: string;
  description: string;
}

const EMPTY_DRAFT: CheckinDraft = { summary: '', description: '', excludedPaths: new Set(), prepared: null };

interface CheckinDraftStore {
  drafts: Record<string, CheckinDraft>;
  setMessage: (workspacePath: string, message: { summary?: string; description?: string }) => void;
  setIncluded: (workspacePath: string, paths: string[], included: boolean) => void;
  /** Checks every file, `paths` being all of them: ends a prepared changelist rather than growing it. */
  includeEverything: (workspacePath: string, paths: string[]) => void;
  /** Checks a changelist's files alone ("Check in this changelist"), the files the user left out kept for later. */
  prepareChangelist: (workspacePath: string, prepared: PreparedChangelist) => void;
  /** Once the prepared changelist is checked in or shelved: back to every file but those the user left out. */
  endPrepared: (workspacePath: string) => void;
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
      updateDraft(workspacePath, (draft) => ({ ...draft, ...withIncluded(draft, paths, included) })),
    includeEverything: (workspacePath, paths) => updateDraft(workspacePath, (draft) => ({ ...draft, ...withEverythingIncluded(draft, paths) })),
    prepareChangelist: (workspacePath, prepared) => updateDraft(workspacePath, (draft) => ({ ...draft, prepared })),
    endPrepared: (workspacePath) => updateDraft(workspacePath, (draft) => ({ ...draft, prepared: null })),
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

/** What the user checked: what the list's checks and the check-in follow. */
export function useCheckinChoice(workspacePath: string): CheckinChoice {
  const excludedPaths = useCheckinDraftStore((state) => (state.drafts[workspacePath] ?? EMPTY_DRAFT).excludedPaths);
  const prepared = useCheckinDraftStore((state) => (state.drafts[workspacePath] ?? EMPTY_DRAFT).prepared);
  return useMemo(() => ({ excludedPaths, prepared }), [excludedPaths, prepared]);
}
