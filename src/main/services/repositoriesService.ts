import type { RepositoriesApi } from '@shared/api/repositories';
import type { RepositorySummary } from '@shared/domain/repository';
import { parseRecords, recordFormat } from '../cm/formatRecords';
import { parseProfiles } from '../cm/profiles';
import type { ServiceContext } from './ServiceContext';

/** Remote servers can be slow or ask for credentials; don't let one hang the home screen. */
const LIST_TIMEOUT_MS = 20_000;

export function createRepositoriesService({ cm }: ServiceContext): RepositoriesApi {
  async function servers() {
    return parseProfiles(await cm.query(['profile', 'list', `--format=${recordFormat(['server', 'user', 'workingmode'])}`]));
  }

  async function list(server: string): Promise<RepositorySummary[]> {
    const format = recordFormat(['repid', 'repname', 'repserver', 'repowner']);
    const output = await cm.execute(['repository', 'list', server, `--format=${format}`], {
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    });
    return parseRecords(output)
      .map(([id = '', name = '', repositoryServer = server, owner = '']) => ({
        id,
        name,
        server: repositoryServer,
        owner,
        spec: `${name}@${repositoryServer}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function create(server: string, name: string): Promise<RepositorySummary> {
    await cm.query(['repository', 'create', server, name]);
    const created = (await list(server)).find((repository) => repository.name === name);
    if (!created) throw new Error(`Repository ${name} was not found after creating it.`);
    return created;
  }

  async function rename(repositorySpec: string, newName: string): Promise<void> {
    await cm.query(['repository', 'rename', repositorySpec, newName]);
  }

  async function remove(repositorySpec: string): Promise<void> {
    await cm.query(['repository', 'delete', repositorySpec]);
  }

  return { servers, list, create, rename, remove };
}
