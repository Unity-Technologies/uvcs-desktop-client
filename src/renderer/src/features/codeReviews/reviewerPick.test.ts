import { describe, expect, it } from 'vitest';
import type { CodeReviewer } from '@shared/domain/codeReview';
import type { MemberRef } from '@shared/domain/member';
import { NO_GROUPS, reviewerGroups } from './reviewerGroups';
import { changesReviewers, dialogPick, isPicked, pickChanges, pickedKind, pickerEmptyText, pickOffered, startPick, togglePicked } from './reviewerPick';

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

describe('a pick of reviewers read with their types', () => {
  // The page reads its review's reviewers with `cm codereview reviewer list`, which says which are groups.
  const STAFF: CodeReviewer = { name: 'staff', status: 'Reviewed', kind: 'group' };

  it('removes a group reviewer as a group though the server lists no groups', () => {
    const pick = togglePicked(startPick([ANA, STAFF], NO_GROUPS), user('staff'));
    expect(pickChanges(pick, NO_GROUPS)).toEqual({ add: [], remove: [group('staff')] });
  });

  it('shows a group reviewer as a group though the server lists no groups', () => {
    expect(pickedKind(startPick([STAFF], NO_GROUPS), 'staff', NO_GROUPS)).toBe('group');
  });
});

describe('dialogPick', () => {
  const STAFF: CodeReviewer = { name: 'staff', status: 'Under review', kind: 'group' };

  it('waits for the review’s reviewers typed by cm before it offers a pick', () => {
    expect(dialogPick(null, { reviewers: [{ name: 'staff', status: 'Under review' }], settled: false }, NO_GROUPS)).toBeNull();
  });

  it('starts from the reviewers cm typed once they are read', () => {
    expect(dialogPick(null, { reviewers: [STAFF], settled: true }, NO_GROUPS)).toEqual(startPick([STAFF], NO_GROUPS));
  });

  it('starts from the reviewers as the list read them where cm could not type them', () => {
    const untyped: CodeReviewer = { name: 'Developers', status: 'Under review' };
    expect(dialogPick(null, { reviewers: [untyped], settled: true }, GROUPS)?.picked).toEqual([group('Developers')]);
  });

  it('keeps what the user picked once they picked', () => {
    const picked = togglePicked(startPick([STAFF], NO_GROUPS), user('eva@acme.com'));
    expect(dialogPick(picked, { reviewers: [], settled: true }, NO_GROUPS)).toBe(picked);
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
