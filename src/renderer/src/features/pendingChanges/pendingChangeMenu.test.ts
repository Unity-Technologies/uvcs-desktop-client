import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { countedArray } from '@shared/testing/countedReads';
import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { SEPARATOR, type MenuEntry } from '../../lib/actions';
import { itemCopySubmenu, pendingChangeMenu } from './pendingChangeMenu';

describe('itemCopySubmenu', () => {
  // Right-clicking 50,000 selected changes joined every path twice, full and relative, before the menu showed. What
  // each entry copies is in menuGrammar.test.ts.
  it('reads the paths of a selection only when one of its entries copies them', () => {
    const { array: paths, reads } = countedArray(Array.from({ length: 1_000 }, (_, index) => `src/file${index}.ts`));
    expect(itemCopySubmenu('/ws', paths)).not.toBeNull();
    expect(reads()).toBe(0);
  });
});

describe('Search matches', () => {
  const change = (path: string, kinds: ChangeKind[]): PendingChange => ({ path, kinds, itemType: 'file', size: 0, lastModified: '' });
  const deleted = change('src/Player.cs', ['locallyDeleted']);
  const added = change('src/Hero.cs', ['private']);
  const listed = [deleted, added];
  const offers = (menu: MenuEntry[]) => menu.some((entry) => entry !== SEPARATOR && entry.id === 'searchMatches');

  it('is offered on one item deleted from disk, one private item, or one move the detection made', () => {
    const detected: PendingChange = { ...change('src/Gun.cs', ['locallyMoved']), oldPath: 'src/Weapon.cs' };
    expect(offers(pendingChangeMenu('/ws', [deleted], [], undefined, undefined, undefined, listed))).toBe(true);
    expect(offers(pendingChangeMenu('/ws', [added], [], undefined, undefined, undefined, listed))).toBe(true);
    expect(offers(pendingChangeMenu('/ws', [detected], [], undefined, undefined, undefined, [...listed, detected]))).toBe(true);
  });

  it('is not offered on several items, on other changes, or where the list is not at hand (the palette)', () => {
    expect(offers(pendingChangeMenu('/ws', listed, [], undefined, undefined, undefined, listed))).toBe(false);
    expect(offers(pendingChangeMenu('/ws', [change('src/Map.cs', ['changed'])], [], undefined, undefined, undefined, listed))).toBe(false);
    expect(offers(pendingChangeMenu('/ws', [deleted], []))).toBe(false);
  });
});
