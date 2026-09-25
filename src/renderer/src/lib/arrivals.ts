/**
 * Tells which keys of a list just arrived, so their rows can animate in once. The first keys seen are the list as it
 * loaded, not arrivals. A key stays an arrival for `windowMs`, long enough for its animation to finish even if the
 * row re-renders or a virtualized list remounts it meanwhile; after that it never animates again.
 */
export class Arrivals {
  private readonly firstSeen = new Map<string, number>();
  private primed = false;

  constructor(private readonly windowMs: number) {}

  update(keys: readonly string[], now: number): ReadonlySet<string> {
    const arrived = new Set<string>();
    for (const key of keys) {
      const seen = this.firstSeen.get(key);
      if (seen === undefined) {
        this.firstSeen.set(key, this.primed ? now : -Infinity);
        if (this.primed) arrived.add(key);
      } else if (now - seen < this.windowMs) {
        arrived.add(key);
      }
    }
    this.primed = true;
    return arrived;
  }
}
