import { EVERYONE, OWNER, type MemberRef } from '@shared/domain/permissions';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { naturalCompare } from '../../lib/naturalCompare';
import { memberLabel, type MemberRole } from './members';

/** Someone the member picker offers. */
export interface MemberCandidate {
  member: MemberRef;
  role: MemberRole;
  label: string;
  /** Already in the list: offered, but not picked again. */
  listed: boolean;
}

interface CandidateSources {
  users: readonly string[];
  groups: readonly string[];
  /** Offer `ALL USERS` and `OWNER` too (adding an entry), not where only a real user or group fits (an owner). */
  specials: boolean;
  listed: ReadonlySet<string>;
  search: string;
}

/** The users and groups matching `search`: the special entries first, then groups, then users, each by name. */
export function memberCandidates({ users, groups, specials, listed, search }: CandidateSources): MemberCandidate[] {
  const candidate = (name: string, role: MemberRole): MemberCandidate => ({
    member: { name, kind: role === 'user' || role === 'owner' ? 'user' : 'group' },
    role,
    label: memberLabel(name),
    listed: listed.has(name),
  });
  const byName = (names: readonly string[]) => [...names].sort(naturalCompare);
  return [
    ...(specials ? [candidate(OWNER, 'owner'), candidate(EVERYONE, 'everyone')] : []),
    ...byName(groups).map((name) => candidate(name, 'group')),
    ...byName(users).map((name) => candidate(name, 'user')),
  ].filter((entry) => matchesWordFilter([entry.label], search));
}
