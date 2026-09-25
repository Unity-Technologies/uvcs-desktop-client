import { create } from 'zustand';

/** How long Changes celebrates a check-in or an update before going back to its usual empty state. */
export const SUCCESS_MOMENT_MS = 10_000;

/** What just landed in the workspace: "Checked in cs:4 on /main/task001", "Updated to cs:14 on /main". */
export interface SuccessMoment {
  verb: 'Checked in' | 'Updated to';
  changesetId: number;
  branch: string;
  /** The changeset the workspace was at before an update of several changesets: the card shows the range. */
  fromChangeset?: number;
  /** A second line: the check-in's summary, or who the update brought changes from. */
  detail?: string;
  at: number;
}

interface SuccessMomentStore {
  moments: Record<string, SuccessMoment>;
  show: (workspacePath: string, moment: Omit<SuccessMoment, 'at'>) => void;
  clear: (workspacePath: string) => void;
}

/** The latest success moment per workspace, shown by the Changes empty state while it lasts. */
export const useSuccessMomentStore = create<SuccessMomentStore>((set) => ({
  moments: {},
  show: (workspacePath, moment) => set((state) => ({ moments: { ...state.moments, [workspacePath]: { ...moment, at: Date.now() } } })),
  clear: (workspacePath) =>
    set((state) => {
      const { [workspacePath]: _cleared, ...rest } = state.moments;
      return { moments: rest };
    }),
}));

/** Milliseconds the moment still shows; zero once it's over. */
export function successMomentLeft(moment: SuccessMoment, now: number): number {
  return Math.max(0, moment.at + SUCCESS_MOMENT_MS - now);
}

/** The next change ends the moment: pending changes read after it happened. */
export function isOutlivedByChanges(moment: SuccessMoment, changesReadAt: number, changeCount: number): boolean {
  return changeCount > 0 && changesReadAt > moment.at;
}
