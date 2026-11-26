import type { RepositoriesApi } from '@shared/api/repositories';
import { repositorySpecParts, type RepositoryListing } from '@shared/domain/repository';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { serverProfiles } from '../cm/profiles';
import { repositoryGuidOf } from './repositoryGuidOf';
import type { ProfilesContext, ServiceContext } from './ServiceContext';

/**
 * The listings go through `RepositoryGuids`, which keeps the repositories' GUIDs that what the app keeps for a
 * repository is kept by, and follows a rename made here at once.
 */
export function createRepositoriesService(context: ServiceContext, { profiles }: ProfilesContext): RepositoriesApi {
  const { cm, repositoryGuids, organizationRenames } = context;
  /** The servers; what a Unity organization keeps meanwhile follows it if its owners renamed it (`OrganizationRenames`). */
  async function servers() {
    const listed = serverProfiles(await profiles.read());
    void organizationRenames.listed(listed.map((profile) => profile.server)).catch((error: unknown) => console.warn('[settings] Organizations not followed:', error));
    return listed;
  }

  function list(server: string): Promise<RepositoryListing> {
    return repositoryGuids.list(server);
  }

  async function guidOf(repositorySpec: string): Promise<RepositoryGuid | null> {
    return (await repositoryGuidOf(context, repositorySpec)) ?? null;
  }

  function specNow(repositorySpec: string, guid: RepositoryGuid): Promise<string> {
    return repositoryGuids.specNow(repositorySpec, guid);
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
