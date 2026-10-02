import { describe, expect, it } from 'vitest';
import { NO_BITS, type AclBits, type AclLevel, type ObjectPermissions } from '@shared/domain/permissions';
import { changeLines } from './changeWords';
import { cannotRemoveReason, memberRows } from './members';
import {
  addMember,
  changeCount,
  changeRequest,
  draftBits,
  draftChanges,
  EMPTY_DRAFT,
  needsConfirmation,
  removeMember,
  setOverride,
  setOwner,
  setOwnState,
  undoMember,
} from './permissionsDraft';

const bits = (parts: Partial<AclBits>): AclBits => ({ ...NO_BITS, ...parts });
const level = (creator: string, entries: Record<string, Partial<AclBits>>, inherited: AclLevel[] = []): AclLevel => ({
  creator,
  entries: Object.entries(entries).map(([member, parts]) => ({ member, bits: bits(parts) })),
  inherited,
});

const repository = level('rep:game@repserver:local', { Developers: { allowed: ['read', 'ci'] }, 'ALL USERS': { allowed: ['view'] } });
const own = level('br:/main/task@rep:game@repserver:local', { ana: { denied: ['ci'] }, Developers: { denied: ['rm'] } }, [repository]);
const read: ObjectPermissions = { acl: own, ownAcl: true, owner: { name: 'ana', kind: 'user' } };
const shared: ObjectPermissions = { acl: repository, ownAcl: false, owner: null };
const developers = { name: 'Developers', kind: 'group' } as const;
const ana = { name: 'ana', kind: 'user' } as const;
const groups = new Set(['Developers', 'Leads']);

describe('editing permissions', () => {
  it("sets a member's own entry, starting from what it says, an allow replacing a deny", () => {
    const draft = setOwnState(read, EMPTY_DRAFT, developers, ['rm', 'ci'], 'allow');

    expect(draftBits(read, draft, 'Developers')).toEqual(bits({ allowed: ['rm', 'ci'] }));
    expect(draftBits(read, draft, 'ana')).toEqual(bits({ denied: ['ci'] }));
  });

  it('drops the overrides of a permission that goes back to inherit', () => {
    let draft = setOverride(read, EMPTY_DRAFT, developers, 'read', 'overrideAllowed', true);
    draft = setOverride(read, draft, developers, 'rm', 'overrideDenied', true);
    expect(draftBits(read, draft, 'Developers')).toEqual(bits({ denied: ['rm'], overrideAllowed: ['read'], overrideDenied: ['rm'] }));

    draft = setOwnState(read, draft, developers, ['read', 'rm'], 'inherit');

    expect(draftBits(read, draft, 'Developers')).toEqual(NO_BITS);
  });

  it('starts from nothing on an object sharing its parent’s list', () => {
    const draft = setOwnState(shared, EMPTY_DRAFT, developers, ['rm'], 'deny');

    expect(draftBits(shared, draft, 'Developers')).toEqual(bits({ denied: ['rm'] }));
  });

  it('adds, removes and brings back members, an added one simply going', () => {
    let draft = addMember(EMPTY_DRAFT, { name: 'Leads', kind: 'group' });
    expect(memberRows(read, draft, groups).find((row) => row.label === 'Leads')).toMatchObject({ added: true, setHere: false, changed: false });

    draft = removeMember(draft, { name: 'Leads', kind: 'group' });
    expect(memberRows(read, draft, groups).map((row) => row.label)).not.toContain('Leads');
    expect(changeCount(draftChanges(read, draft))).toBe(0);

    draft = removeMember(draft, ana);
    expect(memberRows(read, draft, groups).map((row) => row.label)).not.toContain('ana');
    expect(draftChanges(read, draft).entries).toEqual([{ member: ana, before: bits({ denied: ['ci'] }), after: NO_BITS, removed: true }]);

    draft = addMember(draft, ana);
    expect(changeCount(draftChanges(read, draft))).toBe(0);
  });

  it("keeps a removed member listed while a list above names it, its entry here gone", () => {
    const draft = removeMember(EMPTY_DRAFT, developers);

    expect(memberRows(read, draft, groups).find((row) => row.label === 'Developers')).toMatchObject({ setHere: false, changed: true });
  });

  it('undoes every edit of a member', () => {
    const draft = undoMember(setOwnState(read, EMPTY_DRAFT, ana, ['ci'], 'allow'), 'ana');

    expect(draftChanges(read, draft).entries).toEqual([]);
  });
});

describe('what saving changes', () => {
  it('lists only entries that end up saying something else, and another owner', () => {
    let draft = setOwnState(read, EMPTY_DRAFT, ana, ['ci'], 'inherit');
    draft = setOwnState(read, draft, developers, ['rm'], 'allow');
    draft = setOwnState(read, draft, developers, ['rm'], 'deny');
    draft = setOwner(draft, { name: 'Leads', kind: 'group' });

    const changes = draftChanges(read, draft);

    expect(changes.entries).toEqual([{ member: ana, before: bits({ denied: ['ci'] }), after: NO_BITS, removed: false }]);
    expect(changes.owner).toEqual({ before: { name: 'ana', kind: 'user' }, after: { name: 'Leads', kind: 'group' } });
    expect(changeCount(changes)).toBe(2);
    expect(draftChanges(read, setOwner(EMPTY_DRAFT, { name: 'ana', kind: 'user' })).owner).toBeUndefined();
  });

  it('asks for what it saves from the list as read', () => {
    const draft = setOwnState(shared, EMPTY_DRAFT, developers, ['ci'], 'deny');

    expect(changeRequest(shared, draftChanges(shared, draft), ['/main'])).toEqual({
      seen: { acl: repository, ownAcl: false },
      entries: [{ member: developers, desired: bits({ denied: ['ci'] }) }],
      branches: ['/main'],
    });
  });

  it('asks to confirm removing an entry, taking away who may change permissions, or giving the object away', () => {
    expect(needsConfirmation(draftChanges(read, setOwnState(read, EMPTY_DRAFT, ana, ['rm'], 'deny')))).toBe(false);
    expect(needsConfirmation(draftChanges(read, removeMember(EMPTY_DRAFT, ana)))).toBe(true);
    expect(needsConfirmation(draftChanges(read, setOwnState(read, EMPTY_DRAFT, developers, ['chgperm'], 'deny')))).toBe(true);
    expect(needsConfirmation(draftChanges(read, setOwner(EMPTY_DRAFT, { name: 'Leads', kind: 'group' })))).toBe(true);
  });

  it('says each change in the dialog’s words', () => {
    let draft = setOwnState(read, EMPTY_DRAFT, developers, ['ci', 'read'], 'allow');
    draft = setOwnState(read, draft, developers, ['rm'], 'inherit');
    draft = setOverride(read, draft, developers, 'read', 'overrideDenied', true);
    draft = removeMember(draft, ana);
    draft = setOwner(draft, { name: 'Leads', kind: 'group' });

    expect(changeLines(draftChanges(read, draft))).toEqual([
      { member: 'Developers', text: 'Allow Read, Check in · Inherit Delete files · Ignore denies above for Read' },
      { member: 'ana', text: 'Removed' },
      { member: 'Owner', text: 'ana → Leads' },
    ]);
  });
});

describe('members', () => {
  it('lists Owner and All users first, then groups, then users, with where each is set', () => {
    const rows = memberRows(read, EMPTY_DRAFT, groups);

    expect(rows.map((row) => [row.label, row.role, row.setHere, row.inheritedFrom])).toEqual([
      ['All users', 'everyone', false, ['rep:game@repserver:local']],
      ['Developers', 'group', true, ['rep:game@repserver:local']],
      ['ana', 'user', true, []],
    ]);
    expect(rows[0]!.member).toEqual({ name: 'ALL USERS', kind: 'group' });
  });

  it('removes only an entry set here, and keeps one on the server', () => {
    const rows = memberRows(read, EMPTY_DRAFT, groups);
    expect(cannotRemoveReason(rows[0]!, read, false, rows)).toMatch(/Set above/);
    expect(cannotRemoveReason(rows[1]!, read, false, rows)).toBeUndefined();

    const server: ObjectPermissions = { acl: level('repserver:local', { 'ALL USERS': { allowed: ['view'] } }), ownAcl: true, owner: null };
    const serverRows = memberRows(server, EMPTY_DRAFT, groups);
    expect(cannotRemoveReason(serverRows[0]!, server, true, serverRows)).toMatch(/at least one/);
  });
});
