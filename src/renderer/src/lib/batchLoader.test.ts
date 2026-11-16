import { describe, expect, it } from 'vitest';
import { batchLoader } from './batchLoader';

/** A loader whose flushes run when the test says, and whose reads it answers one at a time. */
function harness(maxBatch = 3) {
  const flushes: (() => void)[] = [];
  const reads: { keys: number[]; answer: (values?: Map<number, string>) => void; fail: (error: Error) => void }[] = [];
  const loader = batchLoader<number, string>({
    maxBatch,
    schedule: (flush) => flushes.push(flush),
    read: (keys) =>
      new Promise((resolve, reject) => {
        reads.push({ keys: [...keys], answer: (values) => resolve(values ?? new Map(keys.map((key) => [key, `v${key}`]))), fail: reject });
      }),
  });
  const flush = (): void => flushes.splice(0).forEach((run) => run());
  return { loader, reads, flush };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('batchLoader', () => {
  it('reads the keys asked for before a flush in one read, and answers each its own value', async () => {
    const { loader, reads, flush } = harness();
    const a = loader.load(1);
    const b = loader.load(2);
    flush();
    expect(reads.map((read) => read.keys)).toEqual([[1, 2]]);
    reads[0]!.answer();
    expect(await Promise.all([a, b])).toEqual(['v1', 'v2']);
  });

  it('asks for a key once however many ask for it before its read', async () => {
    const { loader, reads, flush } = harness();
    const first = loader.load(1);
    const again = loader.load(1);
    flush();
    expect(reads[0]!.keys).toEqual([1]);
    reads[0]!.answer();
    expect(await Promise.all([first, again])).toEqual(['v1', 'v1']);
  });

  it('splits what is asked into blocks of maxBatch, read one after another, never at once', async () => {
    const { loader, reads, flush } = harness(2);
    const all = Promise.all([1, 2, 3, 4, 5].map((key) => loader.load(key)));
    flush();
    expect(reads.map((read) => read.keys)).toEqual([[1, 2]]);
    reads[0]!.answer();
    await settle();
    expect(reads.map((read) => read.keys)).toEqual([[1, 2], [3, 4]]);
    reads[1]!.answer();
    await settle();
    reads[2]!.answer();
    expect(await all).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
    expect(reads.map((read) => read.keys)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('queues what is asked during a read for the next block', async () => {
    const { loader, reads, flush } = harness();
    const first = loader.load(1);
    flush();
    const later = loader.load(2);
    flush();
    expect(reads.map((read) => read.keys)).toEqual([[1]]);
    reads[0]!.answer();
    await settle();
    expect(reads.map((read) => read.keys)).toEqual([[1], [2]]);
    reads[1]!.answer();
    expect(await Promise.all([first, later])).toEqual(['v1', 'v2']);
  });

  it("fails only a failed block's keys, and keeps reading the next", async () => {
    const { loader, reads, flush } = harness(1);
    const failing = loader.load(1);
    const fine = loader.load(2);
    flush();
    reads[0]!.fail(new Error('server down'));
    await expect(failing).rejects.toThrow('server down');
    await settle();
    reads[1]!.answer();
    expect(await fine).toBe('v2');
  });

  it('fails a key its read gives no value for', async () => {
    const { loader, reads, flush } = harness();
    const missing = loader.load(1);
    flush();
    reads[0]!.answer(new Map());
    await expect(missing).rejects.toThrow();
  });
});
