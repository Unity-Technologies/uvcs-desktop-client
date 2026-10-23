import type { RepositoriesApi } from '@shared/api/repositories';
import { isUnityOrganization } from '@shared/domain/organizations';
import type { RepositoryListing } from '@shared/domain/repository';
import { parseAccounts } from '../cm/accounts';
import { CmError } from '../cm/CmError';
import { serverProfiles } from '../cm/profiles';
import { parseRepositoryListing, refusesTypeOption, repositoryListArgs } from '../cm/repositoryListing';
import type { ProfilesContext, ServiceContext } from './ServiceContext';

/** Remote servers can be slow or ask for credentials; don't let one hang the home screen. */
const LIST_TIMEOUT_MS = 20_000;

export function createRepositoriesService({ cm }: ServiceContext, { profiles }: ProfilesContext): RepositoriesApi {
  async function servers() {
    return serverProfiles(parseAccounts(await profiles.read()));
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
    const output = await cm.execute(repositoryListArgs(server, { withProjects }), { signal: AbortSignal.timeout(LIST_TIMEOUT_MS) });
    return parseRepositoryListing(output, server, { withProjects });
  }

  async function create(server: string, name: string): Promise<string> {
    // `cm repository <repserverspec> <rep_name>` is the documented form for a server; `create` takes only a name.
    await cm.query(['repository', server, name]);
    return `${name}@${server}`;
  }

  async function rename(repositorySpec: string, newName: string): Promise<void> {
    await cm.query(['repository', 'rename', repositorySpec, newName]);
  }

  async function remove(repositorySpec: string): Promise<void> {
    await cm.query(['repository', 'delete', repositorySpec]);
  }

  return { servers, list, create, rename, remove };
}
