/**
 * Measures how much work code does on its input by counting property reads, instead of timing it: the count is the same
 * on any machine under any load, so a test asserting a linear or n·log n bound never flakes.
 *
 * `countedReads(items)` gives each item a proxy that counts every property read; `reads()` is the total so far.
 */
export function countedReads<T extends object>(items: readonly T[]): { items: T[]; reads: () => number } {
  let reads = 0;
  const handler: ProxyHandler<T> = {
    get(target, property, receiver) {
      reads++;
      return Reflect.get(target, property, receiver);
    },
  };
  return { items: items.map((item) => new Proxy(item, handler)), reads: () => reads };
}

/**
 * How much more work `run` does on `build(2n)` than on `build(n)`: about 2 for linear work, a little more for n·log n
 * (sorting), 4 for quadratic. Only reads made by `run` count, not those made while building the input.
 */
export function readGrowthWhenDoubled<T extends object>(n: number, build: (size: number) => readonly T[], run: (items: T[]) => unknown): number {
  const readsFor = (size: number) => {
    const { items, reads } = countedReads(build(size));
    run(items);
    return reads();
  };
  return readsFor(2 * n) / readsFor(n);
}
