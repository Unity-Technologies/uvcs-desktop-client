import { existsSync } from 'node:fs';
import type { SelectorKind, WorkspaceHead } from '@shared/domain/workspace';
import { concurrencyLimit } from '@shared/concurrencyLimit';
import type { CmClient } from './CmClient';
import { FIELD_SEPARATOR } from './formatRecords';
import { isOrganizationIdServer } from './organizationIds';

/** The working mode codes `cm wi --machinereadable` starts its line with; a smart branch is a branch. */
const KINDS_BY_CODE: Record<string, SelectorKind> = { BR: 'branch', CS: 'changeset', LB: 'label', SH: 'shelve' };

/**
 * `cm wi <path> --machinereadable`: one line, `<code><separator><working object><separator><repository spec>`. The
 * separator is a control character (`FIELD_SEPARATOR`), which no branch, label or repository name holds, and which a
 * `cm shell` line takes as it is (it can't take quotes or line breaks).
 */
export function workspaceInfoArgs(workspacePath: string): string[] {
  return ['wi', workspacePath, '--machinereadable', `--fieldseparator=${FIELD_SEPARATOR}`];
}

/**
 * What `cm wi --machinereadable` says a workspace works on: `BR<sep>/main/task<sep>game@local`. Null for anything else
 * (`<path> is not in a workspace.`). Its repository spec names a Unity organization's server by name
 * (`AcmeStudio@unity`); one it could only name by its id (`2398571046213@cloud`, ARCHITECTURE.md "Unity
 * organizations") is left to `cm` (`repository` null), as the app never shows or passes the id form.
 */
export function parseWorkspaceInfo(output: string): WorkspaceHead | null {
  for (const line of output.split(/\r?\n/)) {
    const [code = '', name = '', repository = '', ...rest] = line.split(FIELD_SEPARATOR);
    const kind = KINDS_BY_CODE[code];
    const at = repository.indexOf('@');
    if (!kind || !name || at <= 0 || at === repository.length - 1 || rest.length > 0) continue;
    return {
      repository: isOrganizationIdServer(repository.slice(at + 1)) ? null : repository,
      repositoryName: repository.slice(0, at),
      selector: { kind, name },
    };
  }
  return null;
}

/**
 * One workspace read at a time: each is a pooled `cm shell` command of a few ms, and the pool keeps two sessions per
 * directory, so one stays free for every other read while the list is read. Before the pool is warm, a query runs as
 * a process of its own: one at a time also keeps the home screen from starting a process per workspace.
 */
const CONCURRENT_READS = 1;

/**
 * What each workspace works on, from `cm wi`. `cm` has no form that reads several workspaces at once (`cm workspace
 * list --format` prints no selector), so this runs one command per workspace: the one exception to "One command for N
 * things" (ARCHITECTURE.md "Server budget"), as `wi` only reads this machine (`LOCAL_COMMANDS`). It answers the same from
 * any directory (`anyDirectory`), so the home screen starts no sessions per workspace. A folder that is gone is not
 * asked about (`cm wi` would answer for a workspace holding it); workspaces `cm` can't tell are left out.
 */
export async function readWorkspaceHeads(cm: CmClient, workspacePaths: string[]): Promise<Record<string, WorkspaceHead>> {
  const inTurn = concurrencyLimit(CONCURRENT_READS);
  const heads: Record<string, WorkspaceHead> = {};
  await Promise.all(
    workspacePaths.filter((path) => existsSync(path)).map((path) =>
      inTurn(async () => {
        const output = await cm.query(workspaceInfoArgs(path), { anyDirectory: true }).catch(() => null);
        const head = output === null ? null : parseWorkspaceInfo(output);
        if (head) heads[path] = head;
      }),
    ),
  );
  return heads;
}
