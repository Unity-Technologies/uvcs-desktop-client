import { describe, expect, it } from 'vitest';
import { foldedCommandLine } from './foldedCommandLine';

const ored = (count: number) => Array.from({ length: count }, (_, index) => `targetid = ${100 + index}`).join(' or ');

describe('foldedCommandLine', () => {
  it("folds a long run of one field's ORed conditions around its first and last, counting those between", () => {
    expect(foldedCommandLine(`cm find review where (${ored(50)}) and targettype = 'branch' --format={id}`)).toEqual({
      head: 'cm find review where (targetid = 100 or ',
      hidden: 48,
      tail: " or targetid = 149) and targettype = 'branch' --format={id}",
    });
  });

  it('leaves a few conditions whole', () => {
    expect(foldedCommandLine(`cm find review where (${ored(3)})`)).toBeUndefined();
  });

  it('folds quoted values too, and leaves different fields and lines without any whole', () => {
    const owners = ["owner = 'ana'", "owner = 'bob'", "owner = 'eve'", "owner = 'leo'"].join(' or ');
    expect(foldedCommandLine(`where (${owners})`)).toEqual({ head: "where (owner = 'ana' or ", hidden: 2, tail: " or owner = 'leo')" });
    expect(foldedCommandLine("where id = 1 or name = 'a' or date = 2 or owner = 3")).toBeUndefined();
    expect(foldedCommandLine('cm status --compact')).toBeUndefined();
  });
});
