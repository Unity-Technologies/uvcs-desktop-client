import type { Changelist, PendingChange } from '@shared/domain/pendingChanges';
import { joinComment, splitComment } from '../../lib/comment';
import { changelistNameOf, isCheckinCandidate } from './changeCategories';
import { neededWith, type PendingIndex } from './checkinDependencies';
import { checkinDraftOf, useCheckinDraftStore } from './checkinDraftStore';
import { DEFAULT_CHANGELIST_LABEL } from './changeRows';
import type { PreparedChangelist } from './checkinSelection';

/** The changes of each changelist, by its name: the default changelist's under null (`changelistNameOf`). */
export function changesByChangelist(changes: PendingChange[]): ReadonlyMap<string | null, PendingChange[]> {
  const byName = new Map<string | null, PendingChange[]>();
  for (const change of changes) {
    const name = changelistNameOf(change);
    const inChangelist = byName.get(name);
    if (inChangelist) inChangelist.push(change);
    else byName.set(name, [change]);
  }
  return byName;
}

interface ChangelistCheckin {
  workspacePath: string;
  /** Null for the default changelist, which has no description. */
  changelist: Changelist | null;
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
  const readied = new Set(readiedChanges(workspacePath, changelist, changes, index).map((change) => change.path));
  store.prepareChangelist(workspacePath, { name: changelist?.name ?? null, paths: readied, readied });
  if (!userWroteComment(workspacePath, changelists)) store.setMessage(workspacePath, splitComment(changelist?.description ?? ''));
}

/**
 * What readying a changelist checks: what can go in of its changes, with what they need outside it. The default
 * changelist leaves out the files the user had unchecked (a `Builds/` folder): readying it isn't asking for them, as
 * readying a user changelist, which the user filled by hand, is. Ignored, cloaked or hidden changes never go in, and
 * would keep the default changelist readied while they stay pending (`preparedStillPending`).
 */
function readiedChanges(workspacePath: string, changelist: Changelist | null, changes: PendingChange[], index: PendingIndex): PendingChange[] {
  const { excludedPaths } = checkinDraftOf(workspacePath);
  const asked = changelist ? changes : changes.filter((change) => !excludedPaths.has(change.path));
  return neededWith(asked, index).filter(isCheckinCandidate);
}

/** What the check-in panel says under its button while a changelist is prepared: "Changelist ui", "Default changelist". */
export function preparedChangelistNote(prepared: PreparedChangelist | null): string | null {
  if (!prepared) return null;
  return prepared.name === null ? DEFAULT_CHANGELIST_LABEL : `Changelist ${prepared.name}`;
}

/** Whether the draft holds a comment of the user's own: anything but nothing or a changelist's description as it was put there. */
function userWroteComment(workspacePath: string, changelists: Changelist[]): boolean {
  const comment = joinComment(checkinDraftOf(workspacePath));
  if (!comment) return false;
  return !changelists.some((changelist) => joinComment(splitComment(changelist.description)) === comment);
}
