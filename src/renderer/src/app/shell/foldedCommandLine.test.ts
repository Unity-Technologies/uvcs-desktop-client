import { describe, expect, it } from 'vitest';
import { foldedCommandLine } from './foldedCommandLine';

const ored = (count: number) => Array.from({ length: count }, (_, index) => `targetid = ${100 + index}`).join(' or ');

describe('foldedCommandLine', () => {
  it("folds a long run of one field's ORed conditions to its first and last, saying how many are between", () => {
    expect(foldedCommandLine(`cm find review where (${ored(50)}) and targettype = 'branch' --format={id}`)).toBe(
      "cm find review where (targetid = 100 or …48 more… or targetid = 149) and targettype = 'branch' --format={id}",
    );
  });

  it('leaves a few conditions whole', () => {
    const line = `cm find review where (${ored(3)})`;
    expect(foldedCommandLine(line)).toBe(line);
  });

  it('folds quoted values too, and leaves different fields and lines without any as they are', () => {
    const owners = ["owner = 'ana'", "owner = 'bob'", "owner = 'eve'", "owner = 'leo'"].join(' or ');
    expect(foldedCommandLine(`where (${owners})`)).toBe("where (owner = 'ana' or …2 more… or owner = 'leo')");
    expect(foldedCommandLine("where id = 1 or name = 'a' or date = 2 or owner = 3")).toBe("where id = 1 or name = 'a' or date = 2 or owner = 3");
    expect(foldedCommandLine('cm status --compact')).toBe('cm status --compact');
  });
});
