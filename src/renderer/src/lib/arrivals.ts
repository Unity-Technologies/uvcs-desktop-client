/**
 * Tells which keys of a list just arrived, so their rows can animate in once. The first keys seen are the list as it
 * loaded, not arrivals. A key stays an arrival for `windowMs`, long enough for its animation to finish even if the
 * row re-renders or a virtualized list remounts it meanwhile; after that it never animates again.
 */
export class Arrivals {
  private readonly firstSeen = new Map<string, number>();
  private primed = false;
  private lastKeys: readonly string[] | null = null;
  /** The last keys' arrivals whose window hadn't passed yet. */
  private arriving: string[] = [];

  constructor(private readonly windowMs: number) {}

  /** Given the same array again (a list rendered for another reason), only the few arrivals are looked at, not every key. */
  update(keys: readonly string[], now: number): ReadonlySet<string> {
    if (keys !== this.lastKeys) {
      this.lastKeys = keys;
      this.arriving = [];
      for (const key of keys) {
        const seen = this.firstSeen.get(key);
        if (seen === undefined) {
          this.firstSeen.set(key, this.primed ? now : -Infinity);
          if (this.primed) this.arriving.push(key);
        } else if (seen !== -Infinity) {
          this.arriving.push(key);
        }
      }
      this.primed = true;
    }
    this.arriving = this.arriving.filter((key) => now - this.firstSeen.get(key)! < this.windowMs);
    return new Set(this.arriving);
  }
}
