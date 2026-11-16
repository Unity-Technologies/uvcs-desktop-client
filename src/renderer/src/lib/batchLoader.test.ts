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

/** Lets the reads already answered resolve, and the loader take its next block: promise turns only, no time. */
const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
};

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

  it('splits what is asked into blocks of maxBatch, the newest asks first, read one after another, never at once', async () => {
    const { loader, reads, flush } = harness(2);
    const all = Promise.all([1, 2, 3, 4, 5].map((key) => loader.load(key)));
    flush();
    expect(reads.map((read) => read.keys)).toEqual([[4, 5]]);
    reads[0]!.answer();
    await settle();
    expect(reads.map((read) => read.keys)).toEqual([[4, 5], [2, 3]]);
    reads[1]!.answer();
    await settle();
    reads[2]!.answer();
    expect(await all).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
    expect(reads.map((read) => read.keys)).toEqual([[4, 5], [2, 3], [1]]);
  });

  it('reads first a key asked again, as the newest ask', () => {
    const { loader, reads, flush } = harness(1);
    void loader.load(1);
    void loader.load(2);
    void loader.load(1);
    flush();
    expect(reads[0]!.keys).toEqual([1]);
  });

  it("doesn't read a key whose every ask was withdrawn before its block", async () => {
    const { loader, reads, flush } = harness();
    const scrolledPast = new AbortController();
    const gone = loader.load(1, scrolledPast.signal);
    const stays = loader.load(2);
    scrolledPast.abort(new Error('scrolled past'));
    await expect(gone).rejects.toThrow('scrolled past');
    flush();
    expect(reads.map((read) => read.keys)).toEqual([[2]]);
    reads[0]!.answer();
    expect(await stays).toBe('v2');
  });

  it('still reads a key another ask waits for when one is withdrawn', () => {
    const { loader, reads, flush } = harness();
    const one = new AbortController();
    void loader.load(1, one.signal).catch(() => undefined);
    void loader.load(1);
    one.abort();
    flush();
    expect(reads.map((read) => read.keys)).toEqual([[1]]);
  });

  it('refuses at once an ask already withdrawn', async () => {
    const { loader, reads, flush } = harness();
    const done = new AbortController();
    done.abort(new Error('gone'));
    await expect(loader.load(1, done.signal)).rejects.toThrow('gone');
    flush();
    expect(reads).toEqual([]);
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
    const fine = loader.load(1);
    const failing = loader.load(2);
    flush();
    expect(reads[0]!.keys).toEqual([2]);
    reads[0]!.fail(new Error('server down'));
    await expect(failing).rejects.toThrow('server down');
    await settle();
    reads[1]!.answer();
    expect(await fine).toBe('v1');
  });

  it('fails a key its read gives no value for', async () => {
    const { loader, reads, flush } = harness();
    const missing = loader.load(1);
    flush();
    reads[0]!.answer(new Map());
    await expect(missing).rejects.toThrow();
  });
});
