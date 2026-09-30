import type { PendingChange } from '@shared/domain/pendingChanges';
import { isReviewable } from './pendingReviewStatus';

/** So many files changing within the window is worth reviewing file by file, e.g. an agent editing the code. */
export const BURST_FILES = 8;
export const BURST_WINDOW_MS = 60_000;

export interface ChangeSighting {
  path: string;
  at: number;
}

/** The files that became pending, or were written again, between two reads of the pending changes. */
export function freshlyChangedPaths(previous: PendingChange[], current: PendingChange[]): string[] {
  const before = new Map(previous.map((change) => [change.path, change.lastModified]));
  return current.filter((change) => isReviewable(change) && before.get(change.path) !== change.lastModified).map((change) => change.path);
}

/** Adds the files just seen changing and forgets those seen longer ago than the window. */
export function recordSightings(sightings: ChangeSighting[], paths: string[], now: number): ChangeSighting[] {
  return [...sightings.filter((sighting) => now - sighting.at < BURST_WINDOW_MS), ...paths.map((path) => ({ path, at: now }))];
}

export function isBurst(sightings: ChangeSighting[]): boolean {
  return new Set(sightings.map((sighting) => sighting.path)).size >= BURST_FILES;
}

/** What the reads of one workspace's pending changes have shown so far. */
export interface BurstWatch {
  workspacePath: string;
  changes: PendingChange[];
  sightings: ChangeSighting[];
  /** Once seen, a burst stays until the workspace changes. */
  burst: boolean;
}

/**
 * Takes a settled read of the pending changes. The first read of a workspace is where things stand, not a burst: only
 * what changes after it counts.
 */
export function watchRead(watch: BurstWatch | null, workspacePath: string, changes: PendingChange[], now: number): BurstWatch {
  if (watch?.workspacePath !== workspacePath) return { workspacePath, changes, sightings: [], burst: false };
  const sightings = recordSightings(watch.sightings, freshlyChangedPaths(watch.changes, changes), now);
  return { workspacePath, changes, sightings, burst: watch.burst || isBurst(sightings) };
}
