import type { IssueTrackerSetup, TrackerConnection } from '@shared/domain/issueTrackers';
import { bindingOf, issueReferenceReader, type IssueReferenceReader } from '@shared/issueTrackers/issueReferences';

/** A place's tracker: how its comments read issues, and the connection that reads them. */
export interface PlaceTracker {
  reader: IssueReferenceReader;
  connection: TrackerConnection;
}

/** The tracker of a place's repository, when it has one bound: none, and its comments read no issue. */
export function placeTrackerOf(setup: IssueTrackerSetup | undefined, repository: string | undefined): PlaceTracker | null {
  if (!setup || !repository) return null;
  const binding = bindingOf(setup.bindings, repository);
  const connection = binding && setup.connections.find((kept) => kept.id === binding.connectionId);
  if (!binding || !connection) return null;
  return { reader: issueReferenceReader(binding, connection), connection };
}
