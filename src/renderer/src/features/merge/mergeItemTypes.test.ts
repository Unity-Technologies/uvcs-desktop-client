import { describe, expect, it } from 'vitest';
import { mergeItemTypes } from './mergeItemTypes';

describe('mergeItemTypes', () => {
  it('takes a path with others under it for a folder, any other for a file', () => {
    const typeOf = mergeItemTypes(['/src', '/src/lib/a.ts', '/docs/readme.md', '/Makefile']);
    expect(typeOf('/src')).toBe('directory');
    expect(typeOf('/src/lib')).toBe('directory');
    expect(typeOf('/src/lib/a.ts')).toBe('file');
    expect(typeOf('/Makefile')).toBe('file');
  });

  it("doesn't take a name that only starts like a folder's for one", () => {
    const typeOf = mergeItemTypes(['/src/app', '/src/app.ts']);
    expect(typeOf('/src/app')).toBe('file');
  });
});
