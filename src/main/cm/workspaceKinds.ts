import { existsSync } from 'node:fs';
import type { WorkspaceKind } from '@shared/domain/workspace';
import type { CmClient } from './CmClient';
import { recordFormat } from './formatRecords';
import { WORKSPACE_KIND_FIELDS, workspaceKindOf } from './workspaceKind';
import { workspaceReadTurns, type WorkspaceReadTurns } from './workspaceReadTurns';

/** `cm getworkspacefrompath <path> --format`, printing just what tells the workspace's kind. */
export function workspaceKindArgs(workspacePath: string): string[] {
  return ['getworkspacefrompath', workspacePath, `--format=${recordFormat([...WORKSPACE_KIND_FIELDS])}`];
}

/** How each of these workspaces holds its files, for the ones `cm` can tell. */
export type WorkspaceKindsReader = (workspacePaths: string[]) => Promise<Record<string, WorkspaceKind>>;

/**
 * Reads each listed workspace's kind with `cm getworkspacefrompath`, as `workspaceHeadsReader` reads its head: `cm
 * workspace list --format` prints no type, and `gwp` takes one path, so one local read per workspace (no server call;
 * `getworkspacefrompath` is in `LOCAL_COMMANDS`), from any directory, in the turns the heads take. A folder that is
 * gone is not asked about; a workspace `cm` can't tell is left out.
 */
export function workspaceKindsReader(cm: CmClient, inTurn: WorkspaceReadTurns = workspaceReadTurns()): WorkspaceKindsReader {
  const readKind = ([type = '', dynamic = '']: string[]): WorkspaceKind => workspaceKindOf(type, dynamic);
  return async (workspacePaths) => {
    const kinds: Record<string, WorkspaceKind> = {};
    await Promise.all(
      workspacePaths.filter((path) => existsSync(path)).map((path) =>
        inTurn(async () => {
          const [kind] = await cm.queryRecords(workspaceKindArgs(path), readKind, { anyDirectory: true }).catch((): WorkspaceKind[] => []);
          if (kind) kinds[path] = kind;
        }),
      ),
    );
    return kinds;
  };
}
