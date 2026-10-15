import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repositorySpec } from '@shared/domain/specs';
import type { SelectorKind, WorkspaceHead } from '@shared/domain/workspace';
import type { OrganizationServers } from '../cm/organizationServers';

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
 * Null when it names no full repository spec. The server is as stored: a Unity organization's by its id
 * (`2398571046213@cloud`), which `readWorkspaceHeads` names.
 */
export function parseSelectorFile(text: string): WorkspaceHead | null {
  const repository = /^\s*(?:repository|rep)\s+"([^"]+@[^"]+)"/im.exec(text)?.[1];
  if (!repository) return null;
  const loaded = /^\s*(smartbranch|branch|br|changeset|cs|label|lb|shelve|sh)\s+"([^"]+)"/im.exec(text);
  const kind = loaded && KINDS[loaded[1]!.toLowerCase()];
  return { repository, selector: kind ? { kind, name: loaded[2]! } : null };
}

/**
 * What each workspace works on, from its selector file: no `cm` call, so it's cheap enough for every workspace
 * listed, but for naming a Unity organization's server, once a session (`OrganizationServers`, from the home folder).
 * Workspaces whose file can't be read or understood are left out.
 */
export async function readWorkspaceHeads(workspacePaths: string[], organizations: OrganizationServers): Promise<Record<string, WorkspaceHead>> {
  const heads: Record<string, WorkspaceHead> = {};
  await Promise.all(
    workspacePaths.map(async (path) => {
      const text = await readFile(join(path, '.plastic', 'plastic.selector'), 'utf8').catch(() => null);
      const head = text === null ? null : parseSelectorFile(text);
      if (head) heads[path] = { ...head, repository: await repositoryByName(head.repository, path, organizations) };
    }),
  );
  return heads;
}

/** `name@server` with its server by name: repository names never hold `@`, so the server is all after the first. */
async function repositoryByName(stored: string, workspacePath: string, organizations: OrganizationServers): Promise<string> {
  const at = stored.indexOf('@');
  return repositorySpec(stored.slice(0, at), await organizations.nameOfWorkspaceServer(workspacePath, stored.slice(at + 1)));
}
