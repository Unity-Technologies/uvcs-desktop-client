import { describe, expect, it } from 'vitest';
import { formatArgs, parseArgs } from './argumentLine';

describe('parseArgs', () => {
  it('splits on spaces and keeps quoted parts in one argument', () => {
    expect(parseArgs(`merge  "{yours}" '{incoming}' -title="Yours ({yoursName})" ""`)).toEqual(['merge', '{yours}', '{incoming}', '-title=Yours ({yoursName})', '']);
  });

  it('reads back what formatArgs writes', () => {
    const args = ['-b={base}', 'with space', 'say "hi"', ''];
    expect(parseArgs(formatArgs(args))).toEqual(args);
  });
});
