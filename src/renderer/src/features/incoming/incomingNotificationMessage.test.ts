import { describe, expect, it } from 'vitest';
import type { BranchIncoming } from '@shared/domain/incoming';
import { incomingNotificationMessage, newChangesetCount } from './incomingNotificationMessage';

describe('incomingNotificationMessage', () => {
  it('says who checked in what, and where', () => {
    expect(incomingNotificationMessage({ owner: 'ana@unity3d.com', comment: 'Fix boost\n\nThe boost was too strong.' }, '/main/t1', { count: 1, countCapped: false })).toBe(
      "Ana checked in 'Fix boost' on t1",
    );
  });

  it('counts the others that came in with it', () => {
    expect(incomingNotificationMessage({ owner: 'ana', comment: 'Fix boost' }, '/main/t1', { count: 3, countCapped: false })).toBe("Ana checked in 'Fix boost' on t1 (and 2 more)");
  });

  it('names a deep branch by its own name', () => {
    expect(incomingNotificationMessage({ owner: 'ana', comment: '' }, '/main/child-br-cr-sample/empty-branch2/child_1/subtask', { count: 1, countCapped: false })).toBe('Ana checked in on subtask');
  });

  it('leaves out an empty comment', () => {
    expect(incomingNotificationMessage({ owner: 'bob.smith', comment: '' }, '/main', { count: 1, countCapped: false })).toBe('Bob Smith checked in on main');
  });
});

describe('newChangesetCount', () => {
  const summary = (changesetCount: number, countCapped = false): BranchIncoming => ({
    branch: '/main',
    loadedChangeset: 10,
    headChangeset: 10 + changesetCount,
    changesetCount,
    countCapped,
    authors: [],
  });

  it('counts the changesets that came in since the last check', () => {
    expect(newChangesetCount(summary(3), summary(5))).toEqual({ count: 2, countCapped: false });
  });

  it('counts at least those past the last count once the check stopped counting', () => {
    expect(newChangesetCount(summary(3), summary(100, true))).toEqual({ count: 97, countCapped: true });
  });

  it('knows only that some came in when both checks stopped counting', () => {
    expect(newChangesetCount(summary(100, true), summary(100, true))).toEqual({ count: 1, countCapped: true });
  });
});

describe('a notification after the check stopped counting', () => {
  it('says there are more without a number it does not know', () => {
    expect(incomingNotificationMessage({ owner: 'ana', comment: 'Fix boost' }, '/main', { count: 97, countCapped: true })).toBe("Ana checked in 'Fix boost' on main (and 96+ more)");
    expect(incomingNotificationMessage({ owner: 'ana', comment: 'Fix boost' }, '/main', { count: 1, countCapped: true })).toBe("Ana checked in 'Fix boost' on main (and more)");
  });
});
