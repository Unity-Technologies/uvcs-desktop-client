import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { countedArray } from '@shared/testing/countedReads';
import { itemCopySubmenu } from './pendingChangeMenu';

describe('itemCopySubmenu', () => {
  // Right-clicking 50,000 selected changes joined every path twice, full and relative, before the menu showed. What
  // each entry copies is in menuGrammar.test.ts.
  it('reads the paths of a selection only when one of its entries copies them', () => {
    const { array: paths, reads } = countedArray(Array.from({ length: 1_000 }, (_, index) => `src/file${index}.ts`));
    expect(itemCopySubmenu('/ws', paths)).not.toBeNull();
    expect(reads()).toBe(0);
  });
});
