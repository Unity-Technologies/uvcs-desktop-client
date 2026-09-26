import { describe, expect, it } from 'vitest';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { hasRevisions } from './changeCategories';

const change = (...kinds: ChangeKind[]): PendingChange => ({ path: 'a.txt', kinds, itemType: 'file', size: 1, lastModified: '' });

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
