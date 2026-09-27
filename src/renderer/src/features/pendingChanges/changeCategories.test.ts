import { describe, expect, it } from 'vitest';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { categoryOf, hasRevisions, isShelvable, matchesBranch } from './changeCategories';

const change = (...kinds: ChangeKind[]): PendingChange => ({ path: 'a.txt', kinds, itemType: 'file', size: 1, lastModified: '' });

describe('categoryOf', () => {
  it('takes the first category of any of its kinds, in precedence order', () => {
    expect(categoryOf(change('checkedOut', 'changed'))).toBe('changed');
    expect(categoryOf(change('changed', 'moved'))).toBe('moved');
    expect(categoryOf(change('moved', 'deleted'))).toBe('deleted');
    expect(categoryOf(change('checkedOut', 'copied'))).toBe('added');
    expect(categoryOf(change('locallyMoved'))).toBe('moved');
    expect(categoryOf(change('private'))).toBe('private');
    expect(categoryOf(change('hiddenChanged', 'cloaked'))).toBe('cloaked');
  });

  it('reads a change of no known kind as changed', () => {
    expect(categoryOf(change())).toBe('changed');
  });
});

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
