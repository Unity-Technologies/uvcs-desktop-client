import { create } from 'zustand';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { LinkObject } from '@shared/links/link';
import { branchLabel } from '../../lib/branchLabels';

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

/** What the moment's link names: the changeset, or the range an update of several changesets brought. */
export function successLinkObject({ changesetId, fromChangeset }: Pick<SuccessMoment, 'changesetId' | 'fromChangeset'>): LinkObject {
  return fromChangeset !== undefined && changesetId - fromChangeset > 1 ? { kind: 'changesetRange', from: fromChangeset, to: changesetId } : { kind: 'changeset', id: changesetId };
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

/** What a toast says once a changeset lands and changes stay behind: "Checked in cs:4 on task001" (the branch by its own name). */
export function checkedInMessage(changesetId: number, branch: string): string {
  return `Checked in cs:${changesetId} on ${branchLabel(branch)}`;
}

/**
 * Whether checking in `checkedIn` leaves none of the `pending` changes behind, so Changes ends up empty, where the success
 * moment tells it: then no toast says it too. A check-in that leaves changes behind is told by a toast. Compared by path,
 * not by count: a check-in from Files can add private files Changes never listed.
 */
export function successCardTellsCheckin(checkedIn: PendingChange[], pending: PendingChange[]): boolean {
  const goingIn = new Set(checkedIn.map((change) => change.path));
  return pending.every((change) => goingIn.has(change.path));
}

/**
 * Whether the moment is over. It lasts until the next change (pending changes read after it happened), or until the
 * workspace moves to another changeset (read after it happened: a switch, an update elsewhere). A partial workspace
 * names no loaded changeset (null): there only the next change ends it.
 */
export function isMomentOver(moment: SuccessMoment, changes: { readAt: number; count: number }, workspace: { readAt: number; loadedChangeset: number | null } | undefined): boolean {
  if (changes.count > 0 && changes.readAt > moment.at) return true;
  return workspace !== undefined && workspace.readAt > moment.at && workspace.loadedChangeset !== null && workspace.loadedChangeset !== moment.changesetId;
}
