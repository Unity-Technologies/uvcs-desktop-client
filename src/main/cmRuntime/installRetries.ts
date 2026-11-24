/**
 * How long a failed setup waits before trying again by itself, by how many times it failed in a row: soon at first (a
 * network that blinked), then every five minutes. The windows also retry as soon as the OS says the network is back
 * (`cmRuntime.retry` on the page's `online` event).
 */
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000];

export function retryDelayAfter(failures: number): number {
  return RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)]!;
}
