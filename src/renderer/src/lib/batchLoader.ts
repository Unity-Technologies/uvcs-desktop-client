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
 * asked meanwhile waits for the next block. A failed block fails only its keys. It keeps nothing once answered: the
 * caller's cache does (`branchReviewQuery`).
 */
export function batchLoader<K, V>({ maxBatch, read, schedule = (flush) => setTimeout(flush, 0) }: BatchLoaderOptions<K, V>) {
  const queued = new Map<K, Waiting<V>[]>();
  let flushScheduled = false;
  let reading = false;

  async function drain(): Promise<void> {
    reading = true;
    try {
      while (queued.size > 0) {
        const block = [...queued.entries()].slice(0, maxBatch);
        for (const [key] of block) queued.delete(key);
        await readBlock(block);
      }
    } finally {
      reading = false;
    }
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

  return {
    load(key: K): Promise<V> {
      return new Promise<V>((resolve, reject) => {
        const waiting = queued.get(key);
        if (waiting) waiting.push({ resolve, reject });
        else queued.set(key, [{ resolve, reject }]);
        if (!flushScheduled && !reading) {
          flushScheduled = true;
          schedule(flush);
        }
      });
    },
  };
}
