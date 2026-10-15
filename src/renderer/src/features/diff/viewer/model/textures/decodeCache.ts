/**
 * Kept values (decodes) by key, the most recently used last, sized in bytes: past `keptBytes` the least recently used
 * go. A value's size may be told once it is known (a decode's real size, after it resolves).
 */
export class DecodeCache<T> {
  private readonly entries = new Map<string, { value: T; bytes: number }>();

  constructor(private readonly keptBytes: number) {}

  /** The value, marked as the most recently used. */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Whether the key's value is kept; unlike `get`, it doesn't count as a use. */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  set(key: string, value: T, bytes: number): void {
    this.entries.delete(key);
    this.entries.set(key, { value, bytes });
    this.letGoOfOldest();
  }

  /** Tells a value's real size; the oldest go if the kept ones are now too many. */
  resize(key: string, bytes: number): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.bytes = bytes;
    this.letGoOfOldest();
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }

  private letGoOfOldest(): void {
    let total = 0;
    for (const entry of this.entries.values()) total += entry.bytes;
    for (const [key, entry] of this.entries) {
      if (total <= this.keptBytes) return;
      this.entries.delete(key);
      total -= entry.bytes;
    }
  }
}
