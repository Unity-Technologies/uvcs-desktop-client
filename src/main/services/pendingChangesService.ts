import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type { PendingChangesApi } from '@shared/api/pendingChanges';
import type {
  Changelist,
  CheckinRequest,
  CheckinResult,
  FilterRuleList,
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
import { toAbsolutePath } from '../files/workspacePaths';
import { withRule } from '../workspace/filterRuleFile';
import { shelveAndUndo } from '../workspace/shelveAndUndo';
import type { ServiceContext, SwitchContext } from './ServiceContext';

const FILTER_RULE_FILES: Record<FilterRuleList, string> = {
  ignore: 'ignore.conf',
  cloaked: 'cloaked.conf',
  hidden: 'hidden_changes.conf',
};

const DEFAULT_CHANGELIST = 'Default';
const CREATED_SHELVE = /sh:(\d+)/;

export function createPendingChangesService({ cm, operations }: ServiceContext, { switchShelves, leftChanges }: SwitchContext): PendingChangesApi {
  const shelveAwayDependencies = { cm, records: switchShelves, leftChanges, backupsRoot: join(app.getPath('userData'), 'shelve-backups') };

  async function list(workspacePath: string, filter: PendingChangesFilter): Promise<PendingChangesSnapshot> {
    return parsePendingChanges(await cm.query(pendingChangesStatusArgs(filter), { cwd: workspacePath }));
  }

  function checkin(workspacePath: string, request: CheckinRequest, operationId: string): Promise<CheckinResult> {
    return operations.run(operationId, ({ signal, progressOf }) =>
      withTempFile(request.comment, async (commentsFile) => {
        const output = await explainLockedItems('checked in', () =>
          cm.execute(checkinArgs(absolutePaths(workspacePath, request.paths), commentsFile), {
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
    await cm.query(onLinksThemselves('undo', ...absolutePaths(workspacePath, paths)), { cwd: workspacePath });
  }

  async function undoUnchanged(workspacePath: string, paths?: string[]): Promise<void> {
    const targets = paths ? absolutePaths(workspacePath, paths) : ['-r', workspacePath];
    await cm.query(['undo', '--unchanged', ...targets], { cwd: workspacePath });
  }

  async function add(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(['add', '--coparent', ...absolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }

  async function remove(workspacePath: string, paths: string[]): Promise<void> {
    await cm.query(['remove', ...absolutePaths(workspacePath, paths)], { cwd: workspacePath });
  }

  async function checkout(workspacePath: string, paths: string[]): Promise<void> {
    await explainLockedItems('checked out', () => cm.query(onLinksThemselves('checkout', ...absolutePaths(workspacePath, paths)), { cwd: workspacePath }));
  }

  async function addFilterRule(workspacePath: string, list: FilterRuleList, pattern: string): Promise<void> {
    const rulesFile = join(workspacePath, FILTER_RULE_FILES[list]);
    const current = await readFile(rulesFile, 'utf8').catch(() => '');
    await writeFile(rulesFile, withRule(current, pattern), 'utf8');
  }

  function shelve(workspacePath: string, paths: string[], comment: string, operationId: string): Promise<number> {
    // `--summaryformat` prints just the shelve, in any language, and nothing else: no stages to follow.
    return operations.run(operationId, ({ reportProgress }) => withTempFile(comment, async (commentsFile) => {
      reportProgress('Uploading your changes');
      const output = await cm.execute(
        [
          'shelveset',
          'create',
          ...absolutePaths(workspacePath, paths),
          '--all',
          `-commentsfile=${commentsFile}`,
          '--summaryformat',
        ],
        { cwd: workspacePath },
      );
      const created = CREATED_SHELVE.exec(output);
      if (!created) throw new Error('The shelve finished but no shelve id was reported.');
      return Number(created[1]);
    }));
  }

  async function createChangelist(workspacePath: string, { name, description }: Changelist): Promise<void> {
    await cm.query(['changelist', 'create', name, description, '--persistent'], { cwd: workspacePath });
  }

  async function editChangelist(workspacePath: string, name: string, changes: Changelist): Promise<void> {
    if (changes.description) {
      await cm.query(['changelist', 'edit', name, 'description', changes.description], { cwd: workspacePath });
    }
    if (changes.name !== name) {
      await cm.query(['changelist', 'edit', name, 'rename', changes.name], { cwd: workspacePath });
    }
  }

  async function deleteChangelist(workspacePath: string, name: string): Promise<void> {
    await cm.query(['changelist', 'delete', name], { cwd: workspacePath });
  }

  async function moveToChangelist(workspacePath: string, name: string | null, paths: string[]): Promise<void> {
    await cm.query(['changelist', name ?? DEFAULT_CHANGELIST, 'add', ...absolutePaths(workspacePath, paths)], {
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

function absolutePaths(workspacePath: string, relativePaths: string[]): string[] {
  return relativePaths.map((path) => toAbsolutePath(workspacePath, path));
}
