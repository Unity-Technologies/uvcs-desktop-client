import { describe, expect, it } from 'vitest';
import { isGroup, NO_GROUPS, reviewerFilterTexts, reviewerGroups, reviewerLabel, reviewerRef, typedReviewers } from './reviewerGroups';

// As `cm listusers <server> --onlygroups` prints them, one per line: names may hold spaces.
const GROUPS = reviewerGroups(['Developers', 'Web Devs', 'qa-team']);

describe('reviewer groups', () => {
  it('tells a group from a user by the server’s groups, whatever the case cm wrote either in', () => {
    expect(isGroup('developers', GROUPS)).toBe(true);
    expect(isGroup('Web Devs', GROUPS)).toBe(true);
    expect(isGroup('ana@acme.com', GROUPS)).toBe(false);
  });

  it('names a group as cm takes it, in --groups, and anyone else as a user', () => {
    expect(reviewerRef('Developers', GROUPS)).toEqual({ name: 'Developers', kind: 'group' });
    expect(reviewerRef('ana@acme.com', GROUPS)).toEqual({ name: 'ana@acme.com', kind: 'user' });
  });

  it('reads every reviewer as a user where the server lists no groups', () => {
    expect(reviewerRef('Developers', NO_GROUPS)).toEqual({ name: 'Developers', kind: 'user' });
  });

  it('splits the reviewers typed at commas, once each, ignoring blanks, a group named as one', () => {
    expect(typedReviewers(' ana, developers,,ana , ', GROUPS)).toEqual([
      { name: 'ana', kind: 'user' },
      { name: 'developers', kind: 'group' },
    ]);
    expect(typedReviewers('', GROUPS)).toEqual([]);
  });

  it('shows a group by its own name, and a user by the name shown for them', () => {
    expect(reviewerLabel('qa-team', GROUPS)).toBe('qa-team');
    expect(reviewerLabel('jane.doe@acme.com', GROUPS)).toBe('Jane Doe');
  });

  it('finds a group by its name, and a user by the name shown and as stored', () => {
    expect(reviewerFilterTexts('qa-team', GROUPS)).toEqual(['qa-team']);
    expect(reviewerFilterTexts('jane.doe@acme.com', GROUPS)).toEqual(['Jane Doe', 'jane.doe@acme.com']);
  });
});
