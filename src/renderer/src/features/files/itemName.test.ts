import { describe, expect, it } from 'vitest';
import { itemNameProblem } from './itemName';

const create = { allowFolders: true };
const rename = { allowFolders: false };

describe('itemNameProblem', () => {
  it('accepts a free name, and folders to create along with a new item', () => {
    expect(itemNameProblem('notes.md', ['README.md'], create)).toBeUndefined();
    expect(itemNameProblem('docs/intro.md', ['docs'], create)).toBeUndefined();
  });

  it('tells a name already taken in the folder, whatever its case', () => {
    expect(itemNameProblem('readme.md', ['README.md'], create)).toBe('“README.md” already exists here');
  });

  it('keeps a renamed item in its folder', () => {
    expect(itemNameProblem('docs/a.md', [], rename)).toBe('A name can’t contain “/”');
  });

  it('rejects empty folder names and dot names', () => {
    expect(itemNameProblem('a//b.md', [], create)).toBe('Folder names can’t be empty');
    expect(itemNameProblem('/a.md', [], create)).toBe('Folder names can’t be empty');
    expect(itemNameProblem('../a.md', [], create)).toBe('“.” and “..” aren’t names');
    expect(itemNameProblem('a\\b', [], rename)).toBe('A name can’t contain “\\”');
  });
});
