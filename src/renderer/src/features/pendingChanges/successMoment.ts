import { create } from 'zustand';

/** What just landed in the workspace: "Checked in cs:4", "Updated to cs:14". */
export interface SuccessMoment {
  verb: 'Checked in' | 'Updated to';
  changesetId: number;
  /** The changeset the workspace was at before an update of several changesets: the link opens the range. */
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

/** What a toast says once a changeset lands and changes stay behind: "Checked in cs:4 on /main/task001". */
export function checkedInMessage(changesetId: number, branch: string): string {
  return `Checked in cs:${changesetId} on ${branch}`;
}

/**
 * Whether checking in `checkedIn` of the `pending` changes leaves Changes empty, where the success moment tells it: then
 * no toast says it too. A check-in that leaves changes behind is told by a toast.
 */
export function successCardTellsCheckin(checkedIn: number, pending: number): boolean {
  return checkedIn === pending;
}

/**
 * Whether the moment is over. It lasts until the next change (pending changes read after it happened), or until the
 * workspace moves to another changeset (read after it happened: a switch, an update elsewhere).
 */
export function isMomentOver(moment: SuccessMoment, changes: { readAt: number; count: number }, workspace: { readAt: number; loadedChangeset: number } | undefined): boolean {
  if (changes.count > 0 && changes.readAt > moment.at) return true;
  return workspace !== undefined && workspace.readAt > moment.at && workspace.loadedChangeset !== moment.changesetId;
}
