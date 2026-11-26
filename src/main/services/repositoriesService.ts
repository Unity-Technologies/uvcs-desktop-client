import type { RepositoriesApi } from '@shared/api/repositories';
import { repositorySpecParts, type RepositoryListing } from '@shared/domain/repository';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { serverProfiles } from '../cm/profiles';
import type { ProfilesContext, ServiceContext } from './ServiceContext';

/**
 * `renamed` hears a repository renamed here, by its spec before and after (`game@acme@unity`, `racer@acme@unity`): its
 * issue tracker follows it (`IssueTrackers.repositoryRenamed`). The listings go through `RepositoryGuids`, which keeps
 * the repositories' GUIDs, and follows a rename made here at once.
 */
export function createRepositoriesService({ cm, repositoryGuids, settings }: ServiceContext, { profiles }: ProfilesContext, renamed: (from: string, to: string) => void = () => undefined): RepositoriesApi {
  async function servers() {
    return serverProfiles(await profiles.read());
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
    keepByGuid(repositorySpec, guid);
    return guid;
  }

  /** What the app kept for the repository by its spec, before it kept it by its GUID, moves under its GUID. */
  function keepByGuid(repositorySpec: string, guid: RepositoryGuid): void {
    settings.keepRepositoryByGuid(repositorySpec, guid);
  }

  async function create(server: string, name: string): Promise<string> {
    // `cm repository <repserverspec> <rep_name>` is the documented form for a server; `create` takes only a name.
    await cm.query(['repository', server, name]);
    repositoryGuids.added(server);
    return `${name}@${server}`;
  }

  async function rename(repositorySpec: string, newName: string): Promise<void> {
    await cm.query(['repository', 'rename', repositorySpec, newName]);
    const at = repositorySpec.indexOf('@');
    if (at <= 0) return;
    repositoryGuids.renamed(repositorySpec.slice(at + 1), repositorySpec.slice(0, at), newName);
    renamed(repositorySpec, `${newName}${repositorySpec.slice(at)}`);
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

  return { servers, list, guidOf, create, rename, remove, restore };
}
