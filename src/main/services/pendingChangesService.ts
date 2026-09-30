import { join } from 'node:path';
import { app } from 'electron';
import type { PendingChangesApi } from '@shared/api/pendingChanges';
import type {
  Changelist,
  CheckinRequest,
  CheckinResult,
  PendingChangesFilter,
  PendingChangesSnapshot,
} from '@shared/domain/pendingChanges';
import { checkinArgs } from '../cm/checkinArgs';
import { readCheckinOutput } from '../cm/checkinOutput';
import { explainLockedItems } from '../cm/lockedItems';
import { pendingChangesStatusArgs } from '../cm/pendingChangesStatusArgs';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { readCheckinProgress } from '../cm/progress/checkinProgress';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { withTempFile } from '../files/tempFile';
import { toAbsolutePaths } from '../files/workspacePaths';
import { addFilterRule } from '../workspace/filterRuleFile';
import { shelveAndUndo } from '../workspace/shelveAndUndo';
import type { ServiceContext, SwitchContext } from './ServiceContext';

const DEFAULT_CHANGELIST = 'Default';

export function createPendingChangesService({ cm, operations }: ServiceContext, { switchShelves, leftChanges }: SwitchContext): PendingChangesApi {
  const shelveAwayDependencies = { cm, records: switchShelves, leftChanges, backupsRoot: join(app.getPath('userData'), 'shelve-backups') };

  async function list(workspacePath: string, filter: PendingChangesFilter): Promise<PendingChangesSnapshot> {
    return parsePendingChanges(await cm.query(pendingChangesStatusArgs(filter), { cwd: workspacePath }));
  }

  function checkin(workspacePath: string, request: CheckinRequest, operationId: string): Promise<CheckinResult> {
    return operations.run(operationId, ({ signal, progressOf }) =>
      withTempFile(request.comment, async (commentsFile) => {
        const output = await explainLockedItems('checked in', () =>
          cm.execute(checkinArgs(toAbsolutePaths(workspacePath, request.paths), commentsFile), {
            cwd: workspacePath,
            signal,
            onOutputLine: progressOf(readCheckinProgress),
          }),
        );
        return readCheckinOutput(output);
      }),
    );
  }

  async function undo(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(onLinksThemselves('undo', ...toAbsolutePaths(workspacePath, paths)), { cwd: workspacePath });
  }

  async function undoUnchanged(workspacePath: string, paths?: string[]): Promise<void> {
    const targets = paths ? toAbsolutePaths(workspacePath, paths) : ['-r', workspacePath];
    await cm.query(['undo', '--unchanged', ...targets], { cwd: workspacePath });
  }

  async function add(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(['add', '--coparent', ...toAbsolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }

  async function remove(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(['remove', ...toAbsolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }

  async function checkout(workspacePath: string, paths: string[]): Promise<void> {
    await explainLockedItems('checked out', () => cm.query(onLinksThemselves('checkout', ...toAbsolutePaths(workspacePath, paths)), { cwd: workspacePath }));
  }

  function shelve(workspacePath: string, paths: string[], comment: string, operationId: string): Promise<number> {
    return operations.run(operationId, ({ reportProgress }) =>
      withTempFile(comment, async (commentsFile) => {
        // `--summaryformat` prints just the shelve, in any language, and nothing else: no stages to follow.
        reportProgress('Uploading your changes');
        const args = ['shelveset', 'create', ...toAbsolutePaths(workspacePath, paths), '--all', `-commentsfile=${commentsFile}`, '--summaryformat'];
        return createdShelveId(await cm.execute(args, { cwd: workspacePath }));
      }),
    );
  }

  async function createChangelist(workspacePath: string, { name, description }: Changelist): Promise<void> {
    await cm.query(['changelist', 'create', name, description, '--persistent'], { cwd: workspacePath });
  }

  async function editChangelist(workspacePath: string, name: string, edit: Partial<Changelist>): Promise<void> {
    if (edit.description !== undefined) {
      await cm.query(['changelist', 'edit', name, 'description', edit.description], { cwd: workspacePath });
    }
    if (edit.name !== undefined && edit.name !== name) {
      await cm.query(['changelist', 'edit', name, 'rename', edit.name], { cwd: workspacePath });
    }
  }

  async function deleteChangelist(workspacePath: string, name: string): Promise<void> {
    await cm.query(['changelist', 'delete', name], { cwd: workspacePath });
  }

  async function moveToChangelist(workspacePath: string, name: string | null, paths: string[]): Promise<void> {
    await cm.query(['changelist', name ?? DEFAULT_CHANGELIST, 'add', ...toAbsolutePaths(workspacePath, paths)], {
      cwd: workspacePath,
    });
  }

  return {
    list,
    checkin,
    undo,
    undoUnchanged,
    add,
    remove,
    checkout,
    addFilterRule,
    shelve,
    shelveAndUndo: (workspacePath, paths, comment, operationId) =>
      operations.run(operationId, (context) => shelveAndUndo(shelveAwayDependencies, workspacePath, paths, comment, context)),
    createChangelist,
    editChangelist,
    deleteChangelist,
    moveToChangelist,
  };
}

/** The shelve `cm shelveset create --summaryformat` made: `sh:12@repo@server`. */
function createdShelveId(output: string): number {
  const created = /sh:(\d+)/.exec(output);
  if (!created) throw new Error('The shelve finished but no shelve id was reported.');
  return Number(created[1]);
}
