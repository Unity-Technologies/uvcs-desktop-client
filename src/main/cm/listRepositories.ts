import { isUnityOrganization } from '@shared/domain/organizations';
import type { RepositoryListing } from '@shared/domain/repository';
import type { CmClient } from './CmClient';
import { CmError } from './CmError';
import { readFields } from './formatRecords';
import { refusesTypeOption, repositoryListArgs, repositoryListingOf } from './repositoryListing';

/** Remote servers can be slow or ask for credentials; don't let one hang the home screen. */
const LIST_TIMEOUT_MS = 20_000;

/**
 * The server's repositories, from one `cm repository list`; a Unity organization's projects come with them, in the same
 * command. Only `RepositoryGuids` calls it, which every listing goes through.
 */
export async function listRepositories(cm: CmClient, server: string): Promise<RepositoryListing> {
  if (!isUnityOrganization(server)) return listOnce(cm, server, false);
  try {
    return await listOnce(cm, server, true);
  } catch (error) {
    if (!(error instanceof CmError) || !refusesTypeOption(error.message)) throw error;
    return listOnce(cm, server, false);
  }
}

async function listOnce(cm: CmClient, server: string, withProjects: boolean): Promise<RepositoryListing> {
  const records = await cm.executeRecords(repositoryListArgs(server, { withProjects }), readFields, { signal: AbortSignal.timeout(LIST_TIMEOUT_MS), server });
  return repositoryListingOf(records, server, { withProjects });
}
