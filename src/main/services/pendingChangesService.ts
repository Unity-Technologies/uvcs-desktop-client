import { open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type { PendingChangesApi } from '@shared/api/pendingChanges';
import type {
  Changelist,
  CheckinRequest,
  CheckinResult,
  MovePair,
  MoveSimilarity,
  PendingChangesFilter,
  PendingChangesSnapshot,
} from '@shared/domain/pendingChanges';
import { workspacePlace } from '@shared/domain/place';
import { spec } from '@shared/domain/specs';
import { checkinArgs } from '../cm/checkinArgs';
import { deletedFilesArgs, deletedFilesOf, type DeletedFile } from '../cm/deletedFiles';
import { readTreeItem } from '../cm/treeItems';
import { textForLog } from '../cm/hideSecrets';
import { readCheckinOutput } from '../cm/checkinOutput';
import { changeRequestsNotApplied } from '../cm/changeRequestsNotApplied';
import { CmError } from '../cm/CmError';
import { readWorkspaceLoad } from '../cm/workspaceStatus';
import { explainLockedItems } from '../cm/lockedItems';
import { pendingChangesStatusOptions } from '../cm/pendingChangesStatusOptions';
import { readCheckinProgress } from '../cm/progress/checkinProgress';
import { shelveCreateArgs } from '../cm/shelveCreateArgs';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { withTempDirectory, withTempFile } from '../files/tempFile';
import { moveArgs } from '../files/moveItems';
import { toAbsolutePaths, workspaceFileOf } from '../files/workspacePaths';
import { addFilterRules } from '../workspace/filterRuleFile';
import { readPendingChanges } from '../workspace/readPendingChanges';
import { BINARY_SNIFF_BYTES, looksBinary } from '../files/fileContent';
import { listNarrowingDown } from '../workspace/listNarrowingDown';
import { measureMoveSimilarities, type FileGlance } from '../workspace/moveSimilarities';
import { shelveAndUndo } from '../workspace/shelveAndUndo';
import { kindFromHeaders } from '../workspace/shelveFlowDependencies';
import type { ServiceContext, SwitchContext } from './ServiceContext';

const DEFAULT_CHANGELIST = 'Default';

export function createPendingChangesService({ cm, operations, revisionCat, headers }: ServiceContext, { switchShelves, leftChanges }: SwitchContext): PendingChangesApi {
  const kindOf = kindFromHeaders(headers);
  const shelveAwayDependencies = { cm, records: switchShelves, leftChanges, backupsRoot: join(app.getPath('userData'), 'shelve-backups'), kindOf };

  function list(workspacePath: string, filter: PendingChangesFilter): Promise<PendingChangesSnapshot> {
    return readPendingChanges(cm, workspacePath, pendingChangesStatusOptions(filter), { diskDetails: true });
  }

  function checkin(workspacePath: string, request: CheckinRequest, operationId: string): Promise<CheckinResult> {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      const kind = await kindOf(workspacePath);
      return withTempFile(request.comment, async (commentsFile) => {
        try {
          const output = await explainLockedItems('checked in', () =>
            cm.execute(checkinArgs(toAbsolutePaths(workspacePath, request.paths), commentsFile, request.addsPrivate, kind), {
              cwd: workspacePath,
              signal,
              onOutputLine: progressOf(readCheckinProgress),
            }),
          );
          return readCheckinOutput(output);
        } catch (error) {
          return checkedInApplyingNone(workspacePath, request.comment, error);
        }
      });
    });
  }

  /**
   * A checkin whose comment names a change request no review has pending (`changeRequestsNotApplied`): `cm` made the
   * changeset, then failed without saying which, so the workspace's own status, a local read, tells it. Any other
   * failure, or a workspace with no one changeset loaded (partial), is the failure it was.
   */
  async function checkedInApplyingNone(workspacePath: string, comment: string, error: unknown): Promise<CheckinResult> {
    const notApplied = error instanceof CmError ? changeRequestsNotApplied(error.command.output, comment) : null;
    if (!notApplied) throw error;
    const { selector, loadedChangeset } = await readWorkspaceLoad(cm, workspacePath);
    if (loadedChangeset === null || selector.kind !== 'branch') throw error;
    return { kind: 'created', changesetId: loadedChangeset, branch: selector.name, changeRequestsNotApplied: { requests: notApplied, logEntryId: (error as CmError).command.logEntryId } };
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

  async function recordMove(workspacePath: string, deletedPath: string, newPath: string): Promise<void> {
    // `cm move` of an item missing from disk onto an existing private one only records the move; were the item back on
    // disk, it refuses, as the destination exists.
    await cm.query(moveArgs(workspacePath, { from: deletedPath, to: newPath }), { cwd: workspacePath });
  }

  function moveSimilarities(workspacePath: string, pairs: MovePair[]): Promise<MoveSimilarity[]> {
    return withTempDirectory((directory) => {
      let saved = 0;
      // The paths come from the window, which isn't trusted: each one must be inside the workspace (`workspaceFileOf`).
      const fileOf = (path: string) => workspaceFileOf(workspacePath, path);
      return measureMoveSimilarities(pairs, {
        listDeleted: (paths) => listDeletedFiles(workspacePath, paths),
        // By revision, in its repository: `RevisionCat` reads those asked together with a `cm cat` per repository.
        readDeleted: async ({ revision }) => {
          const target = join(directory, String(saved++));
          await revisionCat.save(workspacePlace(workspacePath), { spec: spec.revision(revision), repository: revision.repository }, target);
          return readFile(target);
        },
        glanceAtAdded: (path) => glanceAt(fileOf(path)),
        readAdded: (path) => readFile(fileOf(path)),
        onUnreadable: (path, error) => console.warn(`[search matches] Couldn't read ${path} to measure it:`, textForLog(String(error))),
      });
    });
  }

  /**
   * The deleted files `cm ls` lists, narrowed down in halves where it fails on one it can't find (`listNarrowingDown`):
   * the others are measured all the same.
   */
  function listDeletedFiles(workspacePath: string, paths: readonly string[]): Promise<Map<string, DeletedFile>> {
    // The paths come from the window, which isn't trusted: each one must be inside the workspace (`workspaceFileOf`).
    return listNarrowingDown(paths, async (listed) =>
      deletedFilesOf(await cm.queryRecords(deletedFilesArgs(listed.map((path) => workspaceFileOf(workspacePath, path))), readTreeItem, { cwd: workspacePath })),
    );
  }

  async function checkout(workspacePath: string, paths: string[]): Promise<void> {
    await explainLockedItems('checked out', () => cm.query(onLinksThemselves('checkout', ...toAbsolutePaths(workspacePath, paths)), { cwd: workspacePath }));
  }

  function shelve(workspacePath: string, paths: string[], comment: string, operationId: string): Promise<number> {
    return operations.run(operationId, ({ reportProgress }) =>
      withTempFile(comment, async (commentsFile) => {
        reportProgress('Uploading your changes');
        const kind = await kindOf(workspacePath);
        // `--summaryformat` prints just the shelve, in any language, and nothing else: no stages to follow. `cm partial`
        // has no such option and prints "Created shelve sh:12@…", which `createdShelveId` reads as well.
        const summary = kind === 'partial' ? [] : ['--summaryformat'];
        const args = [...shelveCreateArgs(toAbsolutePaths(workspacePath, paths), commentsFile, kind), ...summary];
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
    recordMove,
    moveSimilarities,
    checkout,
    addFilterRules,
    shelve,
    shelveAndUndo: (workspacePath, request, comment, operationId) =>
      operations.run(operationId, (context) => shelveAndUndo(shelveAwayDependencies, workspacePath, request, comment, context)),
    createChangelist,
    editChangelist,
    deleteChangelist,
    moveToChangelist,
  };
}

/** The shelve `cm shelveset create --summaryformat` (`sh:12@repo@server`) or `cm partial shelveset create` made. */
function createdShelveId(output: string): number {
  const created = /sh:(\d+)/.exec(output);
  if (!created) throw new Error('The shelve finished but no shelve id was reported.');
  return Number(created[1]);
}

/** A file's size and whether its start looks binary (`looksBinary`), reading only that start. */
async function glanceAt(file: string): Promise<FileGlance> {
  const handle = await open(file, 'r');
  try {
    const { size } = await handle.stat();
    const start = Buffer.alloc(Math.min(size, BINARY_SNIFF_BYTES));
    const { bytesRead } = await handle.read(start, 0, start.length, 0);
    return { size, isBinary: looksBinary(start.subarray(0, bytesRead)) };
  } finally {
    await handle.close();
  }
}
