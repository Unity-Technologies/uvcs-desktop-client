import { describe, expect, it } from 'vitest';
import type { CodeReviewer } from '@shared/domain/codeReview';
import type { MemberRef } from '@shared/domain/member';
import { NO_GROUPS, reviewerGroups } from './reviewerGroups';
import { changesReviewers, isPicked, pickChanges, pickedKind, pickerEmptyText, pickOffered, startPick, togglePicked } from './reviewerPick';

const ANA: CodeReviewer = { name: 'ana@acme.com', status: 'Reviewed' };
const BOB: CodeReviewer = { name: 'bob@acme.com', status: 'Under review' };
const DEVELOPERS: CodeReviewer = { name: 'Developers', status: 'Under review' };
/** The server's groups, as `cm listusers --onlygroups` lists them. */
const GROUPS = reviewerGroups(['Developers', 'Artists']);

const user = (name: string): MemberRef => ({ name, kind: 'user' });
const group = (name: string): MemberRef => ({ name, kind: 'group' });

describe('the reviewer pick', () => {
  it('starts with the reviewers checked, changing nothing', () => {
    const pick = startPick([ANA, BOB], GROUPS);
    expect(isPicked(pick, 'ANA@acme.com')).toBe(true);
    expect(pickChanges(pick, GROUPS)).toEqual({ add: [], remove: [] });
  });

  it('adds who was checked and removes who was unchecked, whatever the case', () => {
    const pick = togglePicked(togglePicked(startPick([ANA, BOB], GROUPS), user('Bob@acme.com')), user('eva@acme.com'));
    expect(pickChanges(pick, GROUPS)).toEqual({ add: [user('eva@acme.com')], remove: [user('bob@acme.com')] });
  });

  it('removes a group reviewer unchecked as a group, and adds a group checked as one', () => {
    const pick = togglePicked(togglePicked(startPick([ANA, DEVELOPERS], GROUPS), group('Developers')), group('Artists'));
    expect(pickChanges(pick, GROUPS)).toEqual({ add: [group('Artists')], remove: [group('Developers')] });
  });

  it('changes nothing for a user checked then unchecked', () => {
    expect(pickChanges(togglePicked(togglePicked(startPick([ANA], GROUPS), user('eva@acme.com')), user('eva@acme.com')), GROUPS)).toEqual({ add: [], remove: [] });
  });

  it("never removes someone another person added while it was open: it goes by the reviewers it opened with", () => {
    const reviewers = [ANA];
    const pick = togglePicked(startPick(reviewers, GROUPS), user('eva@acme.com'));
    reviewers.push({ name: 'carl@acme.com', status: 'Under review' });

    expect(pickChanges(pick, GROUPS)).toEqual({ add: [user('eva@acme.com')], remove: [] });
  });
});

describe('changesReviewers', () => {
  it('lets Save apply a pick that adds or removes someone, and not one that changes no one', () => {
    expect(changesReviewers({ add: [], remove: [] })).toBe(false);
    expect(changesReviewers({ add: [group('Artists')], remove: [] })).toBe(true);
    expect(changesReviewers({ add: [], remove: [user('ana@acme.com')] })).toBe(true);
  });
});

describe('pickedKind', () => {
  it('tells a row a group as it was checked, though the server no longer lists it (an earlier search found it)', () => {
    const pick = togglePicked(startPick([ANA], GROUPS), group('Builders'));
    expect(pickedKind(pick, 'builders', NO_GROUPS)).toBe('group');
  });

  it('tells a row not checked by the server’s groups', () => {
    const pick = startPick([], GROUPS);
    expect(pickedKind(pick, 'Artists', GROUPS)).toBe('group');
    expect(pickedKind(pick, 'eva@acme.com', GROUPS)).toBe('user');
  });

  it('tells the reviewers it opened with by the server’s groups, which may be read after it opened', () => {
    const pick = startPick([DEVELOPERS], NO_GROUPS);
    expect(pickedKind(pick, 'Developers', GROUPS)).toBe('group');
  });
});

describe('a pick opened before the server’s groups were read', () => {
  it('removes a group reviewer as a group, as the groups read by then say', () => {
    const pick = togglePicked(startPick([ANA, DEVELOPERS], NO_GROUPS), user('Developers'));
    expect(pickChanges(pick, GROUPS)).toEqual({ add: [], remove: [group('Developers')] });
  });
});

describe('pickOffered', () => {
  it('never moves a listed user they checked: the rows stay put while picking', () => {
    const pick = togglePicked(startPick([ANA], GROUPS), user('zoe@acme.com'));
    expect(pickOffered(pick, { users: ['zoe@acme.com', 'eva@acme.com', 'ana@acme.com'], groups: [] })).toEqual(['ana@acme.com', 'eva@acme.com', 'zoe@acme.com']);
  });

  it('offers the groups before the users, after the reviewers', () => {
    expect(pickOffered(startPick([ANA], GROUPS), { users: ['eva@acme.com'], groups: ['Developers'] })).toEqual(['ana@acme.com', 'Developers', 'eva@acme.com']);
  });

  it('keeps a user checked from an earlier search in view, where the server only answers the last one', () => {
    const pick = togglePicked(startPick([ANA], GROUPS), user('eva@acme.com'));
    expect(pickOffered(pick, { users: ['bob@acme.com'], groups: [] })).toEqual(['ana@acme.com', 'eva@acme.com', 'bob@acme.com']);
  });
});

describe('pickerEmptyText', () => {
  it('says the users and groups are being read, then that nobody matches', () => {
    expect(pickerEmptyText({ listFailed: false, loading: true, search: '' })).toBe('Reading the users and groups…');
    expect(pickerEmptyText({ listFailed: false, loading: false, search: ' zed ' })).toBe('No one matches “zed”');
  });

  it('asks for a name where the server can not list everyone', () => {
    expect(pickerEmptyText({ listFailed: true, loading: false, search: '' })).toBe('Type a name.');
    expect(pickerEmptyText({ listFailed: true, loading: false, search: 'zed' })).toBe('No one matches “zed”');
  });
});
