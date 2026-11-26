import type { RepositoriesApi } from '@shared/api/repositories';
import { repositorySpecParts, type RepositoryListing } from '@shared/domain/repository';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { serverProfiles } from '../cm/profiles';
import type { ProfilesContext, ServiceContext } from './ServiceContext';

/**
 * The listings go through `RepositoryGuids`, which keeps the repositories' GUIDs that what the app keeps for a
 * repository is kept by, and follows a rename made here at once.
 */
export function createRepositoriesService({ cm, repositoryGuids, organizationRenames, settings, issueTrackers, diffReviews }: ServiceContext, { profiles }: ProfilesContext): RepositoriesApi {
  /** The servers; what a Unity organization keeps meanwhile follows it if its owners renamed it (`OrganizationRenames`). */
  async function servers() {
    const listed = serverProfiles(await profiles.read());
    void organizationRenames.listed(listed.map((profile) => profile.server)).catch((error: unknown) => console.warn('[settings] Organizations not followed:', error));
    return listed;
  }

  function list(server: string): Promise<RepositoryListing> {
    return repositoryGuids.list(server);
  }

  /**
   * From what a listing taught (`RepositoryGuids`): free when the home screen listed the server, else one listing of
   * it. What was kept for the repository by its spec before moves under its GUID then (`keepByGuid`).
   */
  async function guidOf(repositorySpec: string): Promise<RepositoryGuid | null> {
    const parts = repositorySpecParts(repositorySpec);
    const guid = parts && (await repositoryGuids.guidOf(parts.server, parts.name));
    if (!guid) return null;
    await keepByGuid(repositorySpec, guid);
    return guid;
  }

  function specNow(repositorySpec: string, guid: RepositoryGuid): Promise<string> {
    return repositoryGuids.specNow(repositorySpec, guid);
  }

  /**
   * What the app kept for the repository by its spec, before it kept it by its GUID, moves under its GUID: its
   * settings, recent comments, issue tracker and review marks. Done before the GUID is answered, so nothing reads
   * by the GUID before it holds them.
   */
  async function keepByGuid(repositorySpec: string, guid: RepositoryGuid): Promise<void> {
    settings.keepRepositoryByGuid(repositorySpec, guid);
    issueTrackers.keepRepositoryByGuid(repositorySpec, guid);
    await diffReviews.keepRepositoryByGuid(repositorySpec, guid);
  }

  async function create(server: string, name: string): Promise<string> {
    // `cm repository <repserverspec> <rep_name>` is the documented form for a server; `create` takes only a name.
    await cm.query(['repository', server, name]);
    repositoryGuids.added(server);
    return `${name}@${server}`;
  }

  async function rename(repositorySpec: string, newName: string): Promise<void> {
    await cm.query(['repository', 'rename', repositorySpec, newName]);
    const parts = repositorySpecParts(repositorySpec);
    if (parts) repositoryGuids.renamed(parts.server, parts.name, newName);
  }

  async function remove(repositorySpec: string): Promise<void> {
    await cm.query(['repository', 'delete', repositorySpec]);
  }

  /** `cm` refuses a name a live repository has; a new name restores it beside that one. */
  async function restore(deletedSpec: string, newName?: string): Promise<void> {
    await cm.query(['repository', 'undelete', deletedSpec, ...(newName ? [newName] : [])]);
    const restoredOn = repositorySpecParts(deletedSpec)?.server;
    if (restoredOn) repositoryGuids.added(restoredOn);
  }

  return { servers, list, guidOf, specNow, create, rename, remove, restore };
}
