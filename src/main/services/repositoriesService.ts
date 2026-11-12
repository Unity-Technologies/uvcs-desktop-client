import type { RepositoriesApi } from '@shared/api/repositories';
import { isUnityOrganization } from '@shared/domain/organizations';
import type { RepositoryListing, RepositorySummary } from '@shared/domain/repository';
import { CmError } from '../cm/CmError';
import { readFields } from '../cm/formatRecords';
import { serverProfiles } from '../cm/profiles';
import { repositoryListingOf, refusesTypeOption, repositoryListArgs } from '../cm/repositoryListing';
import type { ProfilesContext, ServiceContext } from './ServiceContext';

/** Remote servers can be slow or ask for credentials; don't let one hang the home screen. */
const LIST_TIMEOUT_MS = 20_000;

/**
 * `renamed` hears a repository renamed here, by its spec before and after (`game@acme@unity`, `racer@acme@unity`): its
 * issue tracker follows it (`IssueTrackers.repositoryRenamed`).
 */
export function createRepositoriesService({ cm }: ServiceContext, { profiles }: ProfilesContext, renamed: (from: string, to: string) => void = () => undefined): RepositoriesApi {
  async function servers() {
    return serverProfiles(await profiles.read());
  }

  /** A Unity organization's projects come with its repositories, in the same command. */
  async function list(server: string): Promise<RepositoryListing> {
    if (!isUnityOrganization(server)) return listOnce(server, false);
    try {
      return await listOnce(server, true);
    } catch (error) {
      if (!(error instanceof CmError) || !refusesTypeOption(error.message)) throw error;
      return listOnce(server, false);
    }
  }

  async function listOnce(server: string, withProjects: boolean): Promise<RepositoryListing> {
    const records = await cm.executeRecords(repositoryListArgs(server, { withProjects }), readFields, { signal: AbortSignal.timeout(LIST_TIMEOUT_MS) });
    return repositoryListingOf(records, server, { withProjects });
  }

  async function create(server: string, name: string): Promise<string> {
    // `cm repository <repserverspec> <rep_name>` is the documented form for a server; `create` takes only a name.
    await cm.query(['repository', server, name]);
    return `${name}@${server}`;
  }

  async function rename(repositorySpec: string, newName: string): Promise<void> {
    await cm.query(['repository', 'rename', repositorySpec, newName]);
    const at = repositorySpec.indexOf('@');
    if (at > 0) renamed(repositorySpec, `${newName}${repositorySpec.slice(at)}`);
  }

  async function remove(repositorySpec: string): Promise<void> {
    await cm.query(['repository', 'delete', repositorySpec]);
  }

  /** `cm` refuses a name a live repository has; a new name restores it beside that one. */
  async function restore(deleted: RepositorySummary, newName?: string): Promise<string> {
    await cm.query(['repository', 'undelete', deleted.spec, ...(newName ? [newName] : [])]);
    return `${newName ?? deleted.name}@${deleted.server}`;
  }

  return { servers, list, create, rename, remove, restore };
}
