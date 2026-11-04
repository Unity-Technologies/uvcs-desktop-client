import { describe, expect, it } from 'vitest';
import { countIn, forEachIn, itemsIn, rangeLength, someIn, wholeList, type ItemRange } from './itemRange';

// A folder's run in the middle of its list: the items before and after it are another folder's.
const folder: ItemRange<string> = { list: ['a.txt', 'src/a.ts', 'src/b.png', 'src/c.ts', 'z.ts'], start: 1, end: 4 };

describe('ItemRange', () => {
  it('holds only its run of the list', () => {
    expect(rangeLength(folder)).toBe(3);
    expect(itemsIn(folder)).toEqual(['src/a.ts', 'src/b.png', 'src/c.ts']);
    expect(countIn(folder, (path) => path.endsWith('.ts'))).toBe(2);
    expect(someIn(folder, (path) => path === 'z.ts')).toBe(false);
    expect(someIn(folder, (path) => path.endsWith('.png'))).toBe(true);
    const visited: string[] = [];
    forEachIn(folder, (path) => visited.push(path));
    expect(visited).toEqual(['src/a.ts', 'src/b.png', 'src/c.ts']);
  });

  it('holds every item of a whole list, and none of an empty one', () => {
    expect(itemsIn(wholeList(['a', 'b']))).toEqual(['a', 'b']);
    expect(rangeLength(wholeList([]))).toBe(0);
    expect(someIn(wholeList<string>([]), () => true)).toBe(false);
  });
});
