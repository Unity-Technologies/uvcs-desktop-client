import { describe, expect, it } from 'vitest';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { hasRevisions, isShelvable, matchesBranch } from './changeCategories';

const change = (...kinds: ChangeKind[]): PendingChange => ({ path: 'a.txt', kinds, itemType: 'file', size: 1, lastModified: '' });

describe('matchesBranch', () => {
  it('holds while only files never checked in are pending', () => {
    expect(matchesBranch([change('private'), change('ignored'), change('cloaked')])).toBe(true);
    expect(matchesBranch([change('private'), change('checkedOut', 'changed')])).toBe(false);
    expect(matchesBranch([change('added')])).toBe(false);
  });
});

describe('isShelvable', () => {
  it('takes what is under version control, links aside: cm would shelve the files they point to', () => {
    expect(isShelvable(change('checkedOut', 'changed'))).toBe(true);
    expect(isShelvable(change('added'))).toBe(true);
    expect(isShelvable(change('private'))).toBe(false);
    expect(isShelvable(change('ignored'))).toBe(false);
    expect(isShelvable({ ...change('added'), itemType: 'symlink' })).toBe(false);
  });
});

describe('hasRevisions', () => {
  it('holds for items already in the repository', () => {
    expect(hasRevisions(change('checkedOut', 'changed'))).toBe(true);
    expect(hasRevisions(change('moved'))).toBe(true);
  });

  it('fails for items not checked in yet', () => {
    expect(hasRevisions(change('added'))).toBe(false);
    expect(hasRevisions(change('copied'))).toBe(false);
    expect(hasRevisions(change('private'))).toBe(false);
  });
});
