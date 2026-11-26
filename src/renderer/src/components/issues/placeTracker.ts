import type { IssueTrackerSetup, TrackerConnection } from '@shared/domain/issueTrackers';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { bindingOf, issueReferenceReader, type IssueReferenceReader } from '@shared/issueTrackers/issueReferences';

/** A place's tracker: how its comments read issues, the connection that reads them, and the repository it's bound to. */
export interface PlaceTracker {
  reader: IssueReferenceReader;
  connection: TrackerConnection;
  repository: RepositoryGuid;
}

/**
 * Each setup's trackers by repository, built once: every comment line, chip and editor of a window asks, and a setup
 * read anew (`issueTrackersChanged`) builds them anew.
 */
const built = new WeakMap<IssueTrackerSetup, Map<RepositoryGuid, PlaceTracker | null>>();

/**
 * Whether any repository uses a tracker: only then does a window read its repository's GUID to find its own
 * (`usePlaceTracker`), so one with no tracker anywhere asks nothing.
 */
export function tracksAnyRepository(setup: IssueTrackerSetup | undefined): boolean {
  return setup !== undefined && setup.bindings.length > 0;
}

/** The tracker of a place's repository (its GUID), when it has one bound: none, and its comments read no issue. */
export function placeTrackerOf(setup: IssueTrackerSetup | undefined, repository: RepositoryGuid | undefined): PlaceTracker | null {
  if (!setup || !repository) return null;
  const trackers = built.get(setup) ?? new Map<RepositoryGuid, PlaceTracker | null>();
  built.set(setup, trackers);
  if (!trackers.has(repository)) trackers.set(repository, buildPlaceTracker(setup, repository));
  return trackers.get(repository)!;
}

function buildPlaceTracker(setup: IssueTrackerSetup, repository: RepositoryGuid): PlaceTracker | null {
  const binding = bindingOf(setup.bindings, repository);
  const connection = binding && setup.connections.find((kept) => kept.id === binding.connectionId);
  if (!binding || !connection) return null;
  return { reader: issueReferenceReader(binding, connection), connection, repository };
}
