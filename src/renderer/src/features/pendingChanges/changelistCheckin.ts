import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { joinComment, splitComment } from '../../lib/comment';
import { neededWith, type PendingIndex } from './checkinDependencies';
import { checkinDraftOf, useCheckinDraftStore } from './checkinDraftStore';

/** The changes of each user changelist, by its name; the default changelist's are in none. */
export function changesByChangelist(changes: PendingChange[]): ReadonlyMap<string, PendingChange[]> {
  const byName = new Map<string, PendingChange[]>();
  for (const change of changes) {
    if (!change.changelist) continue;
    const inChangelist = byName.get(change.changelist);
    if (inChangelist) inChangelist.push(change);
    else byName.set(change.changelist, [change]);
  }
  return byName;
}

interface ChangelistCheckin {
  workspacePath: string;
  changelist: Changelist;
  /** Its pending changes, those the filters hide too (`changesByChangelist`). */
  changes: PendingChange[];
  /** Every pending change: what the changelist's changes need goes in with them (`neededWith`). */
  index: PendingIndex;
  /** Every user changelist: a comment one of their descriptions filled is no comment of the user's. */
  changelists: Changelist[];
  /** Clears Changes' filters, "Unreviewed" too: a check-in takes only what they show, and all the changelist goes in. */
  clearFilter: () => void;
}

/**
 * Readies the check-in panel to check in or shelve one changelist, as "Check in this changelist" and "Shelve this
 * changelist" do: its changes checked alone (`PreparedChangelist`, until it is checked in or shelved), and the
 * changelist's description as the comment unless the user wrote one. Nothing runs yet: the user reads or writes the
 * comment and presses the panel's button, so a changelist goes through the check-in every other does (the
 * empty-comment warning, "Update & check in", the question about piles of private files).
 */
export function prepareChangelistCheckin({ workspacePath, changelist, changes, index, changelists, clearFilter }: ChangelistCheckin): void {
  clearFilter();
  const store = useCheckinDraftStore.getState();
  store.prepareChangelist(workspacePath, { name: changelist.name, paths: new Set(neededWith(changes, index).map((change) => change.path)) });
  if (!userWroteComment(workspacePath, changelists)) store.setMessage(workspacePath, splitComment(changelist.description));
}

/** Whether the draft holds a comment of the user's own: anything but nothing or a changelist's description as it was put there. */
function userWroteComment(workspacePath: string, changelists: Changelist[]): boolean {
  const comment = joinComment(checkinDraftOf(workspacePath));
  if (!comment) return false;
  return !changelists.some((changelist) => joinComment(splitComment(changelist.description)) === comment);
}
