import { describe, expect, it } from 'vitest';
import { enclosingFolders, withoutRepeatedFolders } from './enclosingFolders';

describe('enclosingFolders', () => {
  it('names every folder holding a listed path, with or without the root', () => {
    expect([...enclosingFolders(['/src/ui/a.ts', 'docs/b.md'])].sort()).toEqual(['/src', '/src/ui', 'docs']);
  });
});

describe('withoutRepeatedFolders', () => {
  it('drops a folder whose items are listed, keeps an empty one and those it is told to keep', () => {
    const items = ['/a', '/a/b.ts', '/c', '/m', '/m/x.ts'];
    expect(withoutRepeatedFolders(items, (path) => path, (path) => path === '/m')).toEqual(['/a/b.ts', '/c', '/m', '/m/x.ts']);
  });
});
