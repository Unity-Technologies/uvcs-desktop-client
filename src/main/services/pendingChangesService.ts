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
import { checkinArgs } from '../cm/checkinArgs';
import { readCheckinOutput } from '../cm/checkinOutput';
import { explainLockedItems } from '../cm/lockedItems';
import { pendingChangesStatusOptions } from '../cm/pendingChangesStatusOptions';
import { readCheckinProgress } from '../cm/progress/checkinProgress';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { withTempDirectory, withTempFile } from '../files/tempFile';
import { moveArgs } from '../files/moveItems';
import { toAbsolutePath, toAbsolutePaths } from '../files/workspacePaths';
import { addFilterRules } from '../workspace/filterRuleFile';
import { readPendingChanges } from '../workspace/readPendingChanges';
import { BINARY_SNIFF_BYTES, looksBinary } from '../files/fileContent';
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
      return measureMoveSimilarities(pairs, {
        // A deleted file's loaded revision, by its workspace path: `cm cat` reads it there, under an xlink too, so the
        // paths of one workspace share a batch (`RevisionCat`), one `cm cat` for every deleted file.
        readDeleted: async (path) => {
          const target = join(directory, String(saved++));
          await revisionCat.save(workspacePath, { spec: toAbsolutePath(workspacePath, path), repository: workspacePath }, target);
          return readFile(target);
        },
        glanceAtAdded: (path) => glanceAt(toAbsolutePath(workspacePath, path)),
        readAdded: (path) => readFile(toAbsolutePath(workspacePath, path)),
      });
    });
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
