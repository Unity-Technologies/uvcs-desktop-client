import { describe, expect, it } from 'vitest';
import { renameNameProblem } from './renameNameProblem';

describe('renameNameProblem', () => {
  it('takes a name the merge can give the item', () => {
    expect(renameNameProblem('Config (task).cs')).toBeUndefined();
    expect(renameNameProblem('.gitignore')).toBeUndefined();
  });

  it('asks for a name when there is none', () => {
    expect(renameNameProblem('')).toBe('Enter a name.');
    expect(renameNameProblem('   ')).toBe('Enter a name.');
  });

  it('asks for a name without folders when it holds a path', () => {
    expect(renameNameProblem('sub/Config.cs')).toBe('Enter a file name without folders.');
    expect(renameNameProblem('sub\\Config.cs')).toBe('Enter a file name without folders.');
  });

  it('says . and .. name folders, not an item', () => {
    expect(renameNameProblem('.')).toBe('“.” names a folder, not an item: enter another name.');
    expect(renameNameProblem('..')).toBe('“..” names a folder, not an item: enter another name.');
  });
});
