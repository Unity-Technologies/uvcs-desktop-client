/** A header's value, as `Headers.get` answers. */
export type HeaderOf = (name: string) => string | null;

/** How long a tracker that gave no time is left alone. */
export const DEFAULT_REST_MS = 60_000;

/**
 * Until when a tracker asked to be left alone, read from what its answer says (docs/features/issue-trackers.md,
 * "Errors"): `Retry-After` (seconds, or a date), GitHub's `x-ratelimit-reset` and GitLab's `RateLimit-Reset` (seconds
 * since the epoch). A minute when it says nothing.
 */
export function restUntil(header: HeaderOf, now: number): number {
  const retryAfter = header('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return now + seconds * 1000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return date;
  }
  const reset = Number(header('x-ratelimit-reset') ?? header('ratelimit-reset') ?? NaN);
  if (Number.isFinite(reset) && reset > 0) return Math.max(now, reset * 1000);
  return now + DEFAULT_REST_MS;
}

/**
 * Whether an answer is a rate limit: a 429, or GitHub's 403 for its primary limit (`x-ratelimit-remaining: 0`) or its
 * secondary one (`retry-after`). A 403 with neither is no access.
 */
export function isRateLimited(status: number, header: HeaderOf): boolean {
  if (status === 429) return true;
  return status === 403 && (header('x-ratelimit-remaining') === '0' || header('retry-after') !== null);
}

/**
 * The origins a tracker asked to be left alone, until when: meanwhile their requests fail at once, unsent. Kept for
 * the session, in main, so every window and connection to the origin waits alike.
 */
export class TrackerCooldown {
  private readonly resting = new Map<string, number>();

  constructor(private readonly now: () => number) {}

  rest(origin: string, until: number): void {
    this.resting.set(origin, Math.max(until, this.resting.get(origin) ?? 0));
  }

  /** Until when `origin` rests, or null when it may be asked. */
  restingUntil(origin: string): number | null {
    const until = this.resting.get(origin);
    if (until === undefined) return null;
    if (until > this.now()) return until;
    this.resting.delete(origin);
    return null;
  }
}
