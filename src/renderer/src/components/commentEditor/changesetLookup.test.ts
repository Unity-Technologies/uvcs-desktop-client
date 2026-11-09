import { describe, expect, it } from 'vitest';
import { changesetToLookUp } from './changesetLookup';

describe('changesetToLookUp', () => {
  it('looks up a number the newest changesets don’t hold', () => {
    expect(changesetToLookUp('12', [{ label: '4207' }])).toBe(12);
  });

  it('looks nothing up for a number among them, or for words', () => {
    expect(changesetToLookUp('4207', [{ label: '4207' }])).toBeNull();
    expect(changesetToLookUp('switch', [])).toBeNull();
    expect(changesetToLookUp('', [])).toBeNull();
  });
});
