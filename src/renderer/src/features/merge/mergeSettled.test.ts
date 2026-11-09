import { describe, expect, it } from 'vitest';
import { mergeSettled } from './mergeSettled';

describe('mergeSettled', () => {
  it('keeps a merge calculating or ready to decide', () => {
    expect(mergeSettled(undefined, false)).toBe(false);
    expect(mergeSettled('ready', false)).toBe(false);
  });

  it('settles a merge once it completed', () => {
    expect(mergeSettled('ready', true)).toBe(true);
  });

  it('settles a merge that can do nothing', () => {
    expect(mergeSettled('pendingChanges', false)).toBe(true);
    expect(mergeSettled('alreadyMerged', false)).toBe(true);
    expect(mergeSettled('invalidInterval', false)).toBe(true);
  });
});
