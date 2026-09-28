import { describe, expect, it } from 'vitest';
import { isUnchangedCheckout, type PendingChange } from './pendingChanges';

function change(kinds: PendingChange['kinds']): PendingChange {
  return { path: 'a.txt', kinds, itemType: 'file', size: 1, lastModified: '' };
}

describe('isUnchangedCheckout', () => {
  it('is a checkout and nothing else', () => {
    expect(isUnchangedCheckout(change(['checkedOut']))).toBe(true);
  });

  it('is not a checkout with edits, a moved checkout or a change without checkout', () => {
    expect(isUnchangedCheckout(change(['checkedOut', 'changed']))).toBe(false);
    expect(isUnchangedCheckout(change(['checkedOut', 'moved']))).toBe(false);
    expect(isUnchangedCheckout(change(['changed']))).toBe(false);
    expect(isUnchangedCheckout(change([]))).toBe(false);
  });
});
