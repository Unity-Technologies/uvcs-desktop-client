import { describe, expect, it } from 'vitest';
import { sizeChange } from './fileSizeWords';

describe('sizeChange', () => {
  it("says the version before's size, then the version after's", () => {
    expect(sizeChange({ size: 0 }, { size: 2048 })).toBe('0 B → 2.0 KB');
  });

  it('says a version whose content was purged is purged, not empty', () => {
    expect(sizeChange({ size: 0, purged: true }, { size: 2048 })).toBe('Purged → 2.0 KB');
  });
});
