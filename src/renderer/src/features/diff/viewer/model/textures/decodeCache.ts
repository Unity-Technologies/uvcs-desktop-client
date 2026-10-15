export interface DecodeCacheOptions<T> {
  /** The bytes kept, the most recently used first; past them the least recently used go. */
  keptBytes: number;
  /** Frees a value let go of (closes a decode's bitmap): neither kept nor held anymore. */
  release: (value: T) => void;
  /** Everything not held goes this long after the last hold ends: no viewer shows any, and none may soon. */
  emptiedAfterMs: number;
}

interface Entry<T> {
  value: T;
  bytes: number;
}

/**
 * Kept values (decodes) by key, sized in bytes: past `keptBytes` the least recently used go. A value's size may be told
 * once it is known (a decode's real size, after it resolves). What a viewer shows is held (`hold`): it stays past the
 * budget until let go of, so a value is freed (`release`) only once neither kept nor held, never under a viewer's eyes.
 */
export class DecodeCache<T> {
  /** The most recently used last. */
  private readonly kept = new Map<string, Entry<T>>();
  /** Values past the budget that something still holds: freed as the last hold ends. */
  private readonly heldOnly = new Map<string, Entry<T>>();
  /** How many holds each key has. */
  private readonly holds = new Map<string, number>();
  private holders = 0;
  private emptying: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly options: DecodeCacheOptions<T>) {}

  /** The value, marked as the most recently used. */
  get(key: string): T | undefined {
    const entry = this.kept.get(key) ?? this.heldOnly.get(key);
    if (!entry) return undefined;
    this.heldOnly.delete(key);
    this.kept.delete(key);
    this.kept.set(key, entry);
    this.letGoOfOldest();
    return entry.value;
  }

  /** The key's value, kept or held; unlike `get`, it doesn't count as a use. */
  peek(key: string): T | undefined {
    return (this.kept.get(key) ?? this.heldOnly.get(key))?.value;
  }

  /** Whether the key's value is kept; unlike `get`, it doesn't count as a use. */
  has(key: string): boolean {
    return this.kept.has(key) || this.heldOnly.has(key);
  }

  /** Keeps a value for a key that has none (`get` missed). */
  set(key: string, value: T, bytes: number): void {
    this.kept.set(key, { value, bytes });
    this.letGoOfOldest();
  }

  /** Tells a value's real size; the oldest go if the kept ones are now too many. */
  resize(key: string, bytes: number): void {
    const entry = this.kept.get(key) ?? this.heldOnly.get(key);
    if (!entry) return;
    entry.bytes = bytes;
    this.letGoOfOldest();
  }

  /** Forgets a value now, held or not, so the next `get` misses: one that failed, to be tried again. */
  delete(key: string): void {
    const entry = this.kept.get(key) ?? this.heldOnly.get(key);
    if (!entry) return;
    this.kept.delete(key);
    this.heldOnly.delete(key);
    this.options.release(entry.value);
  }

  /**
   * Holds the keys' values (those kept and those to come) past the budget until the returned function lets go of them.
   * The last hold let go of empties the cache `emptiedAfterMs` later, unless another hold comes first.
   */
  hold(keys: Iterable<string>): () => void {
    const held = [...keys];
    for (const key of held) this.holds.set(key, (this.holds.get(key) ?? 0) + 1);
    this.holders++;
    clearTimeout(this.emptying);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const key of held) this.unhold(key);
      if (--this.holders === 0) this.emptying = setTimeout(() => this.clear(), this.options.emptiedAfterMs);
    };
  }

  /** Lets go of every value nothing holds. */
  clear(): void {
    for (const [key, entry] of this.kept) {
      if (this.holds.has(key)) continue;
      this.kept.delete(key);
      this.options.release(entry.value);
    }
  }

  /** How many values are kept or held. */
  get size(): number {
    return this.kept.size + this.heldOnly.size;
  }

  private unhold(key: string): void {
    const count = (this.holds.get(key) ?? 1) - 1;
    if (count > 0) return void this.holds.set(key, count);
    this.holds.delete(key);
    const entry = this.heldOnly.get(key);
    if (!entry) return;
    this.heldOnly.delete(key);
    this.options.release(entry.value);
  }

  private letGo(key: string, entry: Entry<T>): void {
    if (this.holds.has(key)) this.heldOnly.set(key, entry);
    else this.options.release(entry.value);
  }

  private letGoOfOldest(): void {
    let total = 0;
    for (const entry of this.kept.values()) total += entry.bytes;
    for (const [key, entry] of this.kept) {
      if (total <= this.options.keptBytes) return;
      this.kept.delete(key);
      total -= entry.bytes;
      this.letGo(key, entry);
    }
  }
}
