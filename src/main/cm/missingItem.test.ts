import { describe, expect, it } from 'vitest';
import { CmError } from './CmError';
import { notInTreePaths } from './missingItem';

const failure = (output: string): CmError => new CmError(output, { commandLine: 'cm ls', exitCode: 1, output, logEntryId: 1 });

describe('notInTreePaths', () => {
  it("names every path `cm ls` found no such item for in the tree, one line each, as it prints them", () => {
    const output = "Can't resolve the selector for the item /nope/A.cs\nCan't resolve the selector for the item /src/game/Enemy Boss.cs\n";
    expect(notInTreePaths(failure(output))).toEqual(['/nope/A.cs', '/src/game/Enemy Boss.cs']);
  });

  it('names nothing for another failure', () => {
    expect(notInTreePaths(failure('The server is unreachable.'))).toEqual([]);
    expect(notInTreePaths(new Error("Can't resolve the selector for the item /a.cs"))).toEqual([]);
  });
});
