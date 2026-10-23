import { describe, expect, it } from 'vitest';
import { listNarrowingDown } from './listNarrowingDown';

/** A listing that fails as `cm ls` does when any path asked is one it can't find, recording each call. */
function listing(unknown: readonly string[]) {
  const calls: string[][] = [];
  const list = async (paths: readonly string[]) => {
    calls.push([...paths]);
    if (paths.some((path) => unknown.includes(path))) throw new Error('The cm command failed.');
    return new Map(paths.map((path) => [path, path.toUpperCase()]));
  };
  return { calls, list };
}

describe('listing what can be listed', () => {
  it('lists every path with one call when none fails', async () => {
    const { calls, list } = listing([]);

    expect([...(await listNarrowingDown(['a', 'b', 'c'], list)).keys()]).toEqual(['a', 'b', 'c']);
    expect(calls).toHaveLength(1);
  });

  it('lists the others when one path fails, splitting only the half that holds it', async () => {
    const paths = Array.from({ length: 16 }, (_, index) => `p${index}`);
    const { calls, list } = listing(['p5']);

    const listed = await listNarrowingDown(paths, list);

    expect([...listed.keys()].sort()).toEqual(paths.filter((path) => path !== 'p5').sort());
    // The whole, then two halves at each of the four levels down to p5 alone: never one call per path.
    expect(calls).toHaveLength(1 + 2 * 4);
  });

  it('lists nothing for a path that fails alone', async () => {
    const { list } = listing(['a']);

    expect((await listNarrowingDown(['a'], list)).size).toBe(0);
  });

  it('asks nothing for no path', async () => {
    const { calls, list } = listing([]);

    expect((await listNarrowingDown([], list)).size).toBe(0);
    expect(calls).toEqual([]);
  });
});
