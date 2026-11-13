import type { SwitchPreflight, WholeBranchChangesAction } from '@shared/domain/switchWithChanges';
import type { ButtonVariant } from '../../ui/Button';
import { pendingChangesPronoun, UNDO_CHANGES_DESCRIPTION } from '../branches/pendingChangesWords';
import { switchNotes } from '../branches/switchOptions';

/**
 * What downloading a partial workspace's whole branch asks before it starts. It always asks, as it downloads every
 * file: whether to keep or undo the pending changes when there are some (unchanged checkouts are simply undone), or,
 * in an unfinished merge, that it must be checked in or undone first. The changes never stay behind: the workspace
 * stays on its branch, so keeping them is the default, and undoing them only ever the user's own choice.
 */
export interface WholeBranchQuestion {
  asksAboutChanges: boolean;
  blockedByMerge: boolean;
  defaultAction: WholeBranchChangesAction | null;
}

export function wholeBranchQuestion(preflight: SwitchPreflight): WholeBranchQuestion {
  if (preflight.pendingCount === 0 || preflight.unchangedCheckoutsOnly) return { asksAboutChanges: false, blockedByMerge: false, defaultAction: null };
  if (preflight.inMerge) return { asksAboutChanges: true, blockedByMerge: true, defaultAction: null };
  return { asksAboutChanges: true, blockedByMerge: false, defaultAction: 'bring' };
}

/** The user's go-ahead, with what happens to the pending changes when there are some to ask about. */
export interface WholeBranchConfirmation {
  pendingChanges?: WholeBranchChangesAction;
}

/** Whether the download can start: a question about the changes needs an answer, and a merge in progress allows none. */
export function canDownloadWholeBranch(question: WholeBranchQuestion, action: WholeBranchChangesAction | null): boolean {
  return !question.asksAboutChanges || action !== null;
}

/** The go-ahead for what the user chose, which carries a choice only when there was one to make. */
export function wholeBranchConfirmation(action: WholeBranchChangesAction | null): WholeBranchConfirmation {
  return action ? { pendingChanges: action } : {};
}

/** Whether the download can be stopped: not once the changes are shelved or undone, as stopping halfway would leave them in limbo. */
export function wholeBranchCancellable(confirmation: WholeBranchConfirmation): boolean {
  return !confirmation.pendingChanges;
}

/** What the confirmation says the download does, for the branch's name (`branchLabel`). */
export function wholeBranchMessage(branchName: string): string {
  return `Every file on ${branchName} downloads, and this becomes a standard workspace: it can switch to changesets, labels and shelves, and merge.`;
}

export interface WholeBranchCard {
  value: WholeBranchChangesAction;
  title: string;
  description: string;
}

/** The two things the pending changes can do, for how many there are. */
export function wholeBranchCards(pendingCount: number): WholeBranchCard[] {
  const them = pendingChangesPronoun(pendingCount);
  return [
    { value: 'bring', title: `Keep ${them}`, description: `Shelved while the files download, then applied again. If a file conflicts, you decide how to merge it.` },
    { value: 'discard', title: `Undo ${them}`, description: UNDO_CHANGES_DESCRIPTION },
  ];
}

/** The primary button: undoing the changes says so, in red, as it loses them. */
export function wholeBranchButton(action: WholeBranchChangesAction | null): { label: string; variant: ButtonVariant } {
  return action === 'discard' ? { label: 'Undo & download', variant: 'danger' } : { label: 'Download', variant: 'primary' };
}

/**
 * The switch's notes on private files and locks. Changes left on the branch before aren't mentioned: they stay on
 * their shelves, and nothing new is left beside them.
 */
export function wholeBranchNotes(preflight: SwitchPreflight, action: WholeBranchChangesAction | null): string[] {
  return switchNotes({ ...preflight, leftShelveCount: 0 }, action);
}
