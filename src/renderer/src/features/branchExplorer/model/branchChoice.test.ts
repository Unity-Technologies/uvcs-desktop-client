import { describe, expect, it } from 'vitest';
import { isBranchChosen, setBranchesChosen } from './branchChoice';

const all = ['/main', '/main/a', '/main/b'];

describe('branch choice', () => {
  it('starts with every branch chosen, including ones not loaded yet', () => {
    expect(isBranchChosen(null, '/main/new')).toBe(true);
  });

  it('unchecking one keeps the others', () => {
    expect(setBranchesChosen(null, all, ['/main/a'], false)).toEqual(['/main', '/main/b']);
  });

  it('checking the last unchecked one shows every branch again', () => {
    expect(setBranchesChosen(['/main', '/main/b'], all, ['/main/a'], true)).toBeNull();
  });

  it('can uncheck everything', () => {
    expect(setBranchesChosen(null, all, all, false)).toEqual([]);
  });
});
