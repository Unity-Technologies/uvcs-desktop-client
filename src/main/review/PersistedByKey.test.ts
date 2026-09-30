import { describe, expect, it } from 'vitest';
import { PersistedByKey } from './PersistedByKey';

/** A write the test finishes when it says, recording when it started. */
function pendingWrite(name: string, log: string[], outcome: 'succeeds' | 'fails' = 'succeeds') {
  let finish: () => void = () => {};
  const write = (): Promise<void> => {
    log.push(`${name} started`);
    return new Promise((resolve, reject) => (finish = () => (outcome === 'succeeds' ? resolve() : reject(new Error(`${name} failed`)))));
  };
  return { write, finish: () => finish() };
}

/** Once every promise callback already due has run: what can start now has. */
const settled = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('PersistedByKey', () => {
  it('reads each key once, and shares the state it read', async () => {
    const reads: string[] = [];
    const store = new PersistedByKey(async (key) => (reads.push(key), { key }));

    const [first, second] = await Promise.all([store.load('a'), store.load('a')]);
    await store.load('b');
    expect(first).toBe(second);
    expect(reads).toEqual(['a', 'b']);
  });

  it("starts a key's save once its earlier one is done, failed or not, so an older state never lands last", async () => {
    const log: string[] = [];
    const store = new PersistedByKey(async () => null);
    const older = pendingWrite('older', log, 'fails');
    const newer = pendingWrite('newer', log);

    const olderSaved = store.save('a', older.write);
    const newerSaved = store.save('a', newer.write);
    await settled();
    expect(log).toEqual(['older started']);

    older.finish();
    await expect(olderSaved).rejects.toThrow('older failed');
    await settled();
    expect(log).toEqual(['older started', 'newer started']);
    newer.finish();
    await newerSaved;
  });

  it("doesn't hold one key's saves behind another's", async () => {
    const log: string[] = [];
    const store = new PersistedByKey(async () => null);

    void store.save('a', pendingWrite('a', log).write);
    void store.save('b', pendingWrite('b', log).write);
    await settled();
    expect(log).toEqual(['a started', 'b started']);
  });
});
