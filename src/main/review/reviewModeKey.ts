import { placeId, type Place } from '@shared/domain/place';
import type { RepositoryGuid, WorkspaceGuid } from '@shared/domain/stableIds';

/** Where the GUIDs of the places review mode is kept for come from. */
export interface PlaceGuids {
  /** A local read the workspace's window already made (`readWorkspaceGuid`); undefined when `cm` printed none. Rejects when `cm` fails. */
  workspace(workspacePath: string): Promise<WorkspaceGuid | undefined>;
  /** From the server's listing (`RepositoryGuids.guidOf`); undefined when it holds none. Rejects when it can't be listed. */
  repository(server: string, name: string): Promise<RepositoryGuid | undefined>;
}

/**
 * What review mode is kept by for `place` in `reviewModeWorkspaces`: its workspace's GUID, or its repository's for a
 * repository explored without one, which a rename or a move keeps (ARCHITECTURE.md "Settings survive renames"). Its
 * `placeId` (the workspace's path, `repository:<spec>`) when the GUID can't be told: a `cm` that prints none or fails, a
 * server that can't be listed.
 */
export async function reviewModeKeyOf(place: Place, guids: PlaceGuids): Promise<string> {
  const guid = await (place.kind === 'workspace' ? guids.workspace(place.workspacePath) : repositoryGuidOf(place.repository, guids)).catch(() => undefined);
  return guid ?? placeId(place);
}

/** Repository names hold no `@`: the server is everything after the first one (`game@acme@unity`). */
function repositoryGuidOf(repositorySpec: string, guids: PlaceGuids): Promise<RepositoryGuid | undefined> {
  const at = repositorySpec.indexOf('@');
  if (at < 0) return Promise.resolve(undefined);
  return guids.repository(repositorySpec.slice(at + 1), repositorySpec.slice(0, at));
}
