import { PERMISSION_NAMES, type AclBits, type PermissionName } from '@shared/domain/permissions';
import { ownStateOf, type OwnState } from './aclResolution';
import { memberLabel } from './members';
import { PERMISSION_INFO } from './permissionCatalog';
import type { DraftChanges, DraftEntryChange } from './permissionsDraft';

/** One line of the changes to review before saving: whose entry, and what it does. */
export interface ChangeLine {
  /** The member whose entry changes, as `cm` names it; null for the owner. */
  name: string | null;
  member: string;
  text: string;
}

const STATE_WORDS: Record<OwnState, string> = { allow: 'Allow', deny: 'Deny', inherit: 'Inherit' };

const labels = (names: readonly PermissionName[]): string => names.map((name) => PERMISSION_INFO[name].label).join(', ');

/** What a changed entry does, in the dialog's words: "Allow Check in, Read · Deny Delete files". */
export function entryChangeText(change: DraftEntryChange): string {
  if (change.removed) return 'Removed';
  const byState = new Map<OwnState, PermissionName[]>();
  for (const name of PERMISSION_NAMES) {
    const before = ownStateOf(change.before, name);
    const after = ownStateOf(change.after, name);
    if (before !== after) byState.set(after, [...(byState.get(after) ?? []), name]);
  }
  const parts = (['allow', 'deny', 'inherit'] as const).filter((state) => byState.has(state)).map((state) => `${STATE_WORDS[state]} ${labels(byState.get(state)!)}`);
  parts.push(...overrideParts(change.before, change.after, 'overrideAllowed', 'allows'), ...overrideParts(change.before, change.after, 'overrideDenied', 'denies'));
  return parts.join(' · ');
}

function overrideParts(before: AclBits, after: AclBits, kind: 'overrideAllowed' | 'overrideDenied', what: 'allows' | 'denies'): string[] {
  const added = after[kind].filter((name) => !before[kind].includes(name));
  const dropped = before[kind].filter((name) => !after[kind].includes(name));
  return [...(added.length > 0 ? [`Ignore ${what} above for ${labels(added)}`] : []), ...(dropped.length > 0 ? [`Count ${what} above for ${labels(dropped)}`] : [])];
}

/** Every change of the draft, a line each: the entries in their order, then the owner. */
export function changeLines(changes: DraftChanges): ChangeLine[] {
  const lines: ChangeLine[] = changes.entries.map((change) => ({ name: change.member.name, member: memberLabel(change.member.name), text: entryChangeText(change) }));
  if (changes.owner) {
    const { before, after } = changes.owner;
    lines.push({ name: null, member: 'Owner', text: `${before ? `${memberLabel(before.name)} → ` : ''}${memberLabel(after.name)}` });
  }
  return lines;
}
