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
 * How `cm` says no repository goes by a name, in each language it speaks: `The specified repository couldn't be found:
 * game.`, then Spanish, Japanese, Korean, Simplified and Traditional Chinese.
 */
const REPOSITORY_NOT_FOUND = [
  /the specified repository couldn't be found:/i,
  /no se ha podido encontrar el repositorio:/i,
  /指定されたリポジトリが見つかりませんでした/,
  /지정된 리포지토리를 찾을 수 없습니다/,
  /无法找到指定的存储库/,
  /找不到指定的儲存庫/,
];

function isRepositoryNotFoundError(error: unknown): boolean {
  return error instanceof CmError && REPOSITORY_NOT_FOUND.some((pattern) => pattern.test(error.message));
}

/**
 * The id of the repository `repositorySpec` names, under its name now or one a rename left behind: the id
 * `cm repository list` prints with the repository's GUID (`RepositoryGuids`). Undefined when `cm` says no repository
 * goes by that name; rejects on any other failure (a server out of reach, a sign-in), so it's never taken for none.
 */
export async function repositoryIdOf(cm: CmClient, repositorySpec: string, server: string): Promise<string | undefined> {
  try {
    const [id] = await cm.queryRecords(repositoryIdArgs(repositorySpec), ([repid]) => repid || undefined, { server, outsideWorkspaces: true });
    return id;
  } catch (error) {
    if (isRepositoryNotFoundError(error)) return undefined;
    throw error;
  }
}
