import { describe, expect, it } from 'vitest';
import { parseBranchNames } from './branchNames';

const F = '\u001f';
const R = '\u001e';

describe('parseBranchNames', () => {
  it('reads the id and the name of each branch', () => {
    expect(parseBranchNames(`4${F}/main${R}\n37${F}/main/task1${R}\n`)).toEqual([
      { id: 4, name: '/main' },
      { id: 37, name: '/main/task1' },
    ]);
  });
});
