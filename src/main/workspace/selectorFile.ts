import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SelectorKind, WorkspaceHead } from '@shared/domain/workspace';
import { isOrganizationIdServer } from '../cm/organizationIds';

const KINDS: Record<string, SelectorKind> = {
  smartbranch: 'branch',
  br: 'branch',
  branch: 'branch',
  changeset: 'changeset',
  cs: 'changeset',
  label: 'label',
  lb: 'label',
  shelve: 'shelve',
  sh: 'shelve',
};

/**
 * Reads `.plastic/plastic.selector`, which `cm` rewrites on every switch:
 * `repository "name@server"`, then `path "/"`, then what is loaded, e.g. `smartbranch "/main/task"` or `br "/main"`.
 * Null when it names no full repository spec. A Unity organization's server is kept there by its id
 * (`2398571046213@cloud`, ARCHITECTURE.md "Unity organizations"): its repository is left to `cm` (null).
 */
export function parseSelectorFile(text: string): WorkspaceHead | null {
  const repository = /^\s*(?:repository|rep)\s+"([^"]+@[^"]+)"/im.exec(text)?.[1];
  if (!repository) return null;
  const loaded = /^\s*(smartbranch|branch|br|changeset|cs|label|lb|shelve|sh)\s+"([^"]+)"/im.exec(text);
  const kind = loaded && KINDS[loaded[1]!.toLowerCase()];
  const at = repository.indexOf('@');
  const server = repository.slice(at + 1);
  return {
    repository: isOrganizationIdServer(server) ? null : repository,
    repositoryName: repository.slice(0, at),
    selector: kind ? { kind, name: loaded[2]! } : null,
  };
}

/**
 * What each workspace works on, from its selector file: no `cm` call, so it's cheap enough for every workspace
 * listed. Workspaces whose file can't be read or understood are left out.
 */
export async function readWorkspaceHeads(workspacePaths: string[]): Promise<Record<string, WorkspaceHead>> {
  const heads: Record<string, WorkspaceHead> = {};
  await Promise.all(
    workspacePaths.map(async (path) => {
      const text = await readFile(join(path, '.plastic', 'plastic.selector'), 'utf8').catch(() => null);
      const head = text === null ? null : parseSelectorFile(text);
      if (head) heads[path] = head;
    }),
  );
  return heads;
}
