import type {
  BringDisabledReason,
  LeaveDisabledReason,
  PendingChangesAction,
  PendingChangesOnSwitch,
  SwitchChangesAction,
  SwitchPreflight,
} from '@shared/domain/switchWithChanges';
import type { ButtonVariant } from '../../ui/Button';
import { branchLabel } from '../../lib/branchLabels';
import { pluralize } from '../../lib/text';

interface SwitchOption {
  enabled: boolean;
  /** Why it isn't possible, shown under the option. */
  disabledReason?: string;
}

/** Where the question comes up: switching prefers leaving the changes, a new branch bringing them along. */
export type SwitchFlow = 'switch' | 'newBranch';

export interface SwitchChoice {
  leave: SwitchOption;
  bring: SwitchOption;
  /** Undoing the changes, losing them, then switching. */
  discard: SwitchOption;
  /** Preselected, never `discard`: losing changes is always the user's explicit choice. Null when neither is possible. */
  defaultAction: PendingChangesAction | null;
}

/** What switching with these pending changes takes. */
export type SwitchPlan =
  /** Nothing to decide: no pending changes, or only unchanged checkouts (undone on the way). */
  | { kind: 'plain' }
  /** The setting already decided, and it is possible. */
  | { kind: 'automatic'; action: PendingChangesAction }
  | { kind: 'ask'; choice: SwitchChoice }
  /** An unfinished merge must be checked in or undone first. */
  | { kind: 'blockedByMerge'; choice: SwitchChoice };

const BRING_DISABLED: Record<BringDisabledReason, string> = {
  label: 'A label is a fixed snapshot: changes can’t be added to it.',
  shelve: 'Changes can’t be brought to a shelve.',
  otherRepository: 'The target is in another repository.',
};

const LEAVE_DISABLED: Record<LeaveDisabledReason, string> = {
  shelveSource: 'Changes can’t be left on a shelve.',
};

/** Decides whether to ask, and what to offer, from what the workspace holds and where the question comes up. */
export function planSwitch(preflight: SwitchPreflight, setting: PendingChangesOnSwitch, flow: SwitchFlow): SwitchPlan {
  if (preflight.pendingCount === 0 || preflight.unchangedCheckoutsOnly) return { kind: 'plain' };

  const choice = switchChoice(preflight, flow);
  if (preflight.inMerge) return { kind: 'blockedByMerge', choice: disableAll(choice) };
  if (setting !== 'ask' && choice[setting].enabled) return { kind: 'automatic', action: setting };
  return { kind: 'ask', choice };
}

interface PrimaryButton {
  label: string;
  variant: ButtonVariant;
}

/** The primary button of the switch question: undoing the changes says so, in red, as it loses them. */
export function switchButton(action: SwitchChangesAction | null): PrimaryButton {
  return action === 'discard' ? { label: 'Undo & switch', variant: 'danger' } : { label: 'Switch', variant: 'primary' };
}

/** The new-branch dialog's primary button: as `switchButton`, when the workspace is to switch to the new branch. */
export function createBranchButton(action: SwitchChangesAction | null, switching: boolean): PrimaryButton {
  return switching && action === 'discard' ? { label: 'Create & undo changes', variant: 'danger' } : { label: 'Create branch', variant: 'primary' };
}

/** The options for these changes, for a switch or the new-branch dialog. */
function switchChoice(preflight: SwitchPreflight, flow: SwitchFlow): SwitchChoice {
  const leave = option(preflight.leaveDisabledReason && LEAVE_DISABLED[preflight.leaveDisabledReason]);
  const bring = option(preflight.bringDisabledReason && BRING_DISABLED[preflight.bringDisabledReason]);
  const preferred: PendingChangesAction = flow === 'switch' ? 'leave' : 'bring';
  const other: PendingChangesAction = preferred === 'leave' ? 'bring' : 'leave';
  const enabled = { leave, bring };
  const defaultAction = enabled[preferred].enabled ? preferred : enabled[other].enabled ? other : null;
  return { leave, bring, discard: { enabled: true }, defaultAction };
}

/**
 * Things worth knowing before choosing (private files, locks, older left changes), for the option chosen: undoing the
 * changes shelves nothing, and releases the locks for good. Null, as nothing is chosen yet, reads as shelving them.
 */
export function switchNotes(preflight: SwitchPreflight, action: SwitchChangesAction | null): string[] {
  const shelving = action !== 'discard';
  const notes: string[] = [];
  if (preflight.privateCount > 0) {
    const one = preflight.privateCount === 1;
    const stays = shelving ? (one ? 'isn’t shelved: it stays' : 'aren’t shelved: they stay') : one ? 'stays' : 'stay';
    notes.push(`${pluralize(preflight.privateCount, 'private file')} ${stays} in the folder.`);
  }
  if (preflight.lockedPaths.length > 0) {
    const released = shelving ? 'are released while the changes are shelved' : 'are released';
    notes.push(`Your locks on ${pluralize(preflight.lockedPaths.length, 'file')} ${released}.`);
  }
  if (preflight.leftShelveCount > 0) {
    const leftHere = `You already left changes on ${branchLabel(preflight.sourceName)}.`;
    notes.push(action === 'leave' || action === null ? `${leftHere} They stay; leaving these makes another shelve next to them.` : `${leftHere} They stay.`);
  }
  return notes;
}

function option(disabledReason: string | undefined): SwitchOption {
  return disabledReason ? { enabled: false, disabledReason } : { enabled: true };
}

function disableAll(choice: SwitchChoice): SwitchChoice {
  const disabled = { enabled: false };
  return { ...choice, leave: disabled, bring: disabled, discard: disabled, defaultAction: null };
}
