import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import { haveSameListings } from './useTreeListings';

describe('haveSameListings', () => {
  const root: TreeItem[] = [];
  const src: TreeItem[] = [];

  it('holds when every folder has the very same listing', () => {
    expect(haveSameListings(new Map([['', root], ['src', src]]), new Map([['src', src], ['', root]]))).toBe(true);
  });

  it('fails when a folder was listed anew, appeared or went away', () => {
    expect(haveSameListings(new Map([['', root], ['src', []]]), new Map([['', root], ['src', src]]))).toBe(false);
    expect(haveSameListings(new Map([['', root]]), new Map([['', root], ['src', src]]))).toBe(false);
    expect(haveSameListings(new Map([['', root], ['lib', src]]), new Map([['', root], ['src', src]]))).toBe(false);
  });
});
