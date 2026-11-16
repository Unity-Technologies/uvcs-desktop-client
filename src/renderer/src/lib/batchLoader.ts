/** A key's pending answer. */
interface Waiting<V> {
  resolve: (value: V) => void;
  reject: (error: unknown) => void;
}

interface BatchLoaderOptions<K, V> {
  /** The most keys one read asks for. */
  maxBatch: number;
  /** Reads a block of keys, answering every one of them. */
  read: (keys: readonly K[]) => Promise<ReadonlyMap<K, V>>;
  /** When the keys asked so far are read: after what else asks in the same turn (`setTimeout`), by default. */
  schedule?: (flush: () => void) => void;
}

/**
 * Turns many single asks into a few block reads: what is asked before a flush is read together, a key once, in blocks
 * of `maxBatch`, one block at a time (never several reads at once: each is a round trip to a shared server); what is
 * asked meanwhile waits for the next block, the newest asks first (what the user stopped on, not what they scrolled
 * past). An ask whose `signal` aborts is dropped, and a key nobody waits for any more isn't read. A failed block fails
 * only its keys. It keeps nothing once answered: the caller's cache does (`branchReviewQuery`). A read that never
 * settles holds back every later one: `read` must end (`cm`'s own timeouts end it).
 */
export function batchLoader<K, V>({ maxBatch, read, schedule = (flush) => setTimeout(flush, 0) }: BatchLoaderOptions<K, V>) {
  const queued = new Map<K, Waiting<V>[]>();
  let flushScheduled = false;
  let reading = false;

  async function drain(): Promise<void> {
    reading = true;
    try {
      while (queued.size > 0) {
        const block = newestQueued();
        for (const [key] of block) queued.delete(key);
        await readBlock(block);
      }
    } finally {
      reading = false;
    }
  }

  /** The newest `maxBatch` keys asked, oldest of them first. */
  function newestQueued(): [K, Waiting<V>[]][] {
    return [...queued.entries()].slice(-maxBatch);
  }

  async function readBlock(block: [K, Waiting<V>[]][]): Promise<void> {
    try {
      const values = await read(block.map(([key]) => key));
      for (const [key, waiting] of block) {
        if (values.has(key)) waiting.forEach((each) => each.resolve(values.get(key) as V));
        else waiting.forEach((each) => each.reject(new Error(`The read gave no value for ${String(key)}.`)));
      }
    } catch (error) {
      for (const [, waiting] of block) waiting.forEach((each) => each.reject(error));
    }
  }

  function flush(): void {
    flushScheduled = false;
    if (!reading) void drain();
  }

  function enqueue(key: K, waiter: Waiting<V>): void {
    // Asked again, a key moves to the newest end.
    const waiting = queued.get(key) ?? [];
    queued.delete(key);
    queued.set(key, [...waiting, waiter]);
  }

  function withdraw(key: K, waiter: Waiting<V>): void {
    const waiting = queued.get(key);
    if (!waiting) return;
    const rest = waiting.filter((each) => each !== waiter);
    if (rest.length > 0) queued.set(key, rest);
    else queued.delete(key);
  }

  return {
    load(key: K, signal?: AbortSignal): Promise<V> {
      return new Promise<V>((resolve, reject) => {
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        const waiter: Waiting<V> = { resolve, reject };
        enqueue(key, waiter);
        signal?.addEventListener(
          'abort',
          () => {
            withdraw(key, waiter);
            reject(signal.reason);
          },
          { once: true },
        );
        if (!flushScheduled && !reading) {
          flushScheduled = true;
          schedule(flush);
        }
      });
    },
  };
}
