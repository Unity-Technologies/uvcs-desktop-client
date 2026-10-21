import { existsSync } from 'node:fs';
import type { SelectorKind, WorkspaceHead } from '@shared/domain/workspace';
import { concurrencyLimit } from '@shared/concurrencyLimit';
import type { CmClient } from './CmClient';
import { FIELD_SEPARATOR } from './formatRecords';
import { isOrganizationIdServer } from './organizationIds';

/** The working mode codes `cm wi --machinereadable` starts its line with; a smart branch is a branch. */
const KINDS_BY_CODE: Record<string, SelectorKind> = { BR: 'branch', CS: 'changeset', LB: 'label', SH: 'shelve' };

/** What `--machinereadable` prints for a selector that is not one simple thing (several repositories or rules). */
const SEVERAL = ':M:';

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
 * (`<path> is not in a workspace.`) and for a selector over several repositories or rules, whose repository is `:M:`.
 * The working object is `:M:` when the branch rules differ (`br` and `co`) and empty with no branch rule: the
 * repository stays, with no selector. A branch pinned to a changeset (`smartbranch "/main/task" changeset "15"`, what
 * switching to a changeset writes) is `CS<sep>15`, as `cm status` tells it too (`WkConfigType`). The spec names a
 * Unity organization's server by name (`AcmeStudio@unity`); one it could only name by its id (`2398571046213@cloud`,
 * ARCHITECTURE.md "Unity organizations") is left to `cm` (`repository` null), as the app never shows or passes it.
 */
export function parseWorkspaceInfo(output: string): WorkspaceHead | null {
  for (const line of output.split(/\r?\n/)) {
    const [code = '', name = '', repository = '', ...rest] = line.split(FIELD_SEPARATOR);
    const kind = KINDS_BY_CODE[code];
    const at = repository.indexOf('@');
    if (!kind || at <= 0 || at === repository.length - 1 || rest.length > 0) continue;
    const repositoryName = repository.slice(0, at);
    if (repositoryName === SEVERAL) return null;
    return {
      repository: isOrganizationIdServer(repository.slice(at + 1)) ? null : repository,
      repositoryName,
      selector: name && name !== SEVERAL ? { kind, name } : null,
    };
  }
  return null;
}

/**
 * One workspace read at a time, across every call (two windows, a list read again while the last read runs): each is
 * a pooled `cm shell` command of a few ms, and the pool keeps two sessions per directory, so one stays free for every
 * other read. Before the pool is warm, a query runs as a process of its own: one at a time also keeps the home screen
 * from starting a process per workspace.
 */
const CONCURRENT_READS = 1;

/** What each of these workspaces works on, for the ones `cm` can tell. */
export type WorkspaceHeadsReader = (workspacePaths: string[]) => Promise<Record<string, WorkspaceHead>>;

/**
 * Reads what each workspace works on with `cm wi`. `cm` has no form that reads several workspaces at once (`cm
 * workspace list --format` prints no selector), so this runs one command per workspace: a local read with no form for
 * N (ARCHITECTURE.md "Server budget"; `wi` is in `LOCAL_COMMANDS`). It answers the same from any directory
 * (`anyDirectory`), so the home screen starts no sessions per workspace. A folder that is gone is not asked about
 * (`cm wi` would answer for a workspace holding it); workspaces `cm` can't tell are left out. A `wi` that stalls (a
 * network drive that went away) holds the rows after it until the shell's read timeout stops it and that row is left
 * out (`shellCommandTimeoutMs`): a shorter bound would need a `signal`, which sends every read to a process of its own
 * instead of the pooled shell.
 */
export function workspaceHeadsReader(cm: CmClient): WorkspaceHeadsReader {
  const inTurn = concurrencyLimit(CONCURRENT_READS);
  return async (workspacePaths) => {
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
  };
}
