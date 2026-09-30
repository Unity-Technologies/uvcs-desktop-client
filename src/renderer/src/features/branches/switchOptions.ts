import type {
  BringDisabledReason,
  LeaveDisabledReason,
  PendingChangesAction,
  PendingChangesOnSwitch,
  SwitchPreflight,
} from '@shared/domain/switchWithChanges';
import { pluralize } from '../../lib/text';

interface SwitchOption {
  enabled: boolean;
  /** Why it isn't possible, shown under the option. */
  disabledReason?: string;
}

export interface SwitchChoice {
  leave: SwitchOption;
  bring: SwitchOption;
  /** Preselected; null when neither option is possible. */
  defaultAction: PendingChangesAction | null;
  /** Things worth knowing before choosing (private files, locks, older left changes). */
  notes: string[];
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

/** Decides whether to ask, and what to offer, from what the workspace holds. `preferred` is the flow's default choice. */
export function planSwitch(preflight: SwitchPreflight, setting: PendingChangesOnSwitch, preferred: PendingChangesAction): SwitchPlan {
  if (preflight.pendingCount === 0 || preflight.unchangedCheckoutsOnly) return { kind: 'plain' };

  const choice = switchChoice(preflight, preferred);
  if (preflight.inMerge) return { kind: 'blockedByMerge', choice: disableAll(choice) };
  if (setting !== 'ask' && choice[setting].enabled) return { kind: 'automatic', action: setting };
  return { kind: 'ask', choice };
}

/** The two options for these changes; also used by the new-branch dialog. */
function switchChoice(preflight: SwitchPreflight, preferred: PendingChangesAction): SwitchChoice {
  const leave = option(preflight.leaveDisabledReason && LEAVE_DISABLED[preflight.leaveDisabledReason]);
  const bring = option(preflight.bringDisabledReason && BRING_DISABLED[preflight.bringDisabledReason]);
  const other: PendingChangesAction = preferred === 'leave' ? 'bring' : 'leave';
  const enabled = { leave, bring };
  const defaultAction = enabled[preferred].enabled ? preferred : enabled[other].enabled ? other : null;
  return { leave, bring, defaultAction, notes: switchNotes(preflight) };
}

function switchNotes(preflight: SwitchPreflight): string[] {
  const notes: string[] = [];
  if (preflight.privateCount > 0) {
    const one = preflight.privateCount === 1;
    notes.push(`${pluralize(preflight.privateCount, 'private file')} ${one ? 'isn’t shelved: it stays' : 'aren’t shelved: they stay'} in the folder.`);
  }
  if (preflight.lockedPaths.length > 0) {
    notes.push(`Your locks on ${pluralize(preflight.lockedPaths.length, 'file')} are released while the changes are shelved.`);
  }
  if (preflight.leftShelveCount > 0) {
    notes.push(`You already left changes on ${preflight.sourceName}. They stay; leaving these makes another shelve next to them.`);
  }
  return notes;
}

function option(disabledReason: string | undefined): SwitchOption {
  return disabledReason ? { enabled: false, disabledReason } : { enabled: true };
}

function disableAll(choice: SwitchChoice): SwitchChoice {
  return { ...choice, leave: { enabled: false }, bring: { enabled: false }, defaultAction: null };
}
