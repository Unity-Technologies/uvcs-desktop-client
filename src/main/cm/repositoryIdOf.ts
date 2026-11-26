import type { CmClient } from './CmClient';
import { CmError } from './CmError';
import { recordFormat } from './formatRecords';

/**
 * `cm ls` of the root of changeset 0, which every repository has and whose tree is the root alone: one record, its
 * `{repid}`. `cm` takes any name the repository went by (the server keeps a renamed repository's old name as an alias
 * until another repository takes it), while `cm repository list` lists only its name now, and neither `cm find`,
 * `cm status --header` nor `cm wi` prints a repository's id.
 */
export function repositoryIdArgs(repositorySpec: string): string[] {
  return ['ls', '/', `--tree=cs:0@${repositorySpec}`, `--format=${recordFormat(['repid'])}`];
}

/**
 * The id of the repository `repositorySpec` names, under its name now or one a rename left behind: the id
 * `cm repository list` prints with the repository's GUID (`RepositoryGuids`). Undefined when `cm` knows no repository
 * by that name.
 */
export async function repositoryIdOf(cm: CmClient, repositorySpec: string, server: string): Promise<string | undefined> {
  try {
    const [id] = await cm.queryRecords(repositoryIdArgs(repositorySpec), ([repid]) => repid || undefined, { server, outsideWorkspaces: true });
    return id;
  } catch (error) {
    if (error instanceof CmError) return undefined;
    throw error;
  }
}
