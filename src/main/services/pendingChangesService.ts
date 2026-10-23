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
import { explainLockedItems } from '../cm/lockedItems';
import { pendingChangesStatusOptions } from '../cm/pendingChangesStatusOptions';
import { readCheckinProgress } from '../cm/progress/checkinProgress';
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
import type { ServiceContext, SwitchContext } from './ServiceContext';

const DEFAULT_CHANGELIST = 'Default';

export function createPendingChangesService({ cm, operations, revisionCat }: ServiceContext, { switchShelves, leftChanges }: SwitchContext): PendingChangesApi {
  const shelveAwayDependencies = { cm, records: switchShelves, leftChanges, backupsRoot: join(app.getPath('userData'), 'shelve-backups') };

  function list(workspacePath: string, filter: PendingChangesFilter): Promise<PendingChangesSnapshot> {
    return readPendingChanges(cm, workspacePath, pendingChangesStatusOptions(filter), { diskDetails: true });
  }

  function checkin(workspacePath: string, request: CheckinRequest, operationId: string): Promise<CheckinResult> {
    return operations.run(operationId, ({ signal, progressOf }) =>
      withTempFile(request.comment, async (commentsFile) => {
        const output = await explainLockedItems('checked in', () =>
          cm.execute(checkinArgs(toAbsolutePaths(workspacePath, request.paths), commentsFile, request.addsPrivate), {
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
        // `--summaryformat` prints just the shelve, in any language, and nothing else: no stages to follow.
        reportProgress('Uploading your changes');
        // `--dependencies`: the added folders above a path, as a check-in takes them (`checkinArgs`).
        const args = ['shelveset', 'create', ...toAbsolutePaths(workspacePath, paths), '--all', '--dependencies', `-commentsfile=${commentsFile}`, '--summaryformat'];
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

/** The shelve `cm shelveset create --summaryformat` made: `sh:12@repo@server`. */
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
