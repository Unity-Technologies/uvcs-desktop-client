import { describe, expect, it } from 'vitest';
import { renamedPrivateFiles } from './renamedPrivateFiles';

describe('renamedPrivateFiles', () => {
  it('finds the private files cm renamed because the switch wrote a file at their path', () => {
    expect(renamedPrivateFiles(['notes.txt', 'src/a.txt'], ['notes.txt', 'src/a.txt.private.0'])).toEqual([{ path: 'src/a.txt', renamedTo: 'src/a.txt.private.0' }]);
  });

  it('leaves out renamed copies that were already there, and files merely named like one', () => {
    expect(renamedPrivateFiles(['a.txt', 'a.txt.private.0', 'b.private.1'], ['a.txt.private.0', 'b.private.1', 'c.txt.private.0'])).toEqual([]);
  });

  it('takes the next number when an older renamed copy is there', () => {
    expect(renamedPrivateFiles(['a.txt', 'a.txt.private.0'], ['a.txt.private.0', 'a.txt.private.1'])).toEqual([{ path: 'a.txt', renamedTo: 'a.txt.private.1' }]);
  });
});
