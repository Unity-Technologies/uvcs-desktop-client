import { describe, expect, it } from 'vitest';
import { branchChooser, setBranchesChosen } from './branchChoice';

const all = ['/main', '/main/a', '/main/b'];

describe('branch choice', () => {
  it('starts with every branch chosen, including ones not loaded yet', () => {
    expect(branchChooser(null)('/main/new')).toBe(true);
  });

  it('tells the chosen branches from the rest', () => {
    const isChosen = branchChooser(['/main', '/main/b']);
    expect(all.filter(isChosen)).toEqual(['/main', '/main/b']);
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
