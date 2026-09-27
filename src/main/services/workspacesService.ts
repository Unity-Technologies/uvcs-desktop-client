import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type { CreateWorkspaceRequest, WatchCoverage, WorkspacesApi } from '@shared/api/workspaces';
import type { WorkspaceInfo, WorkspaceSummary } from '@shared/domain/workspace';
import { parseRecords, recordFormat } from '../cm/formatRecords';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { switchArgs, UPDATE_ARGS } from '../cm/updateArgs';
import { readWorkingObjectComment } from '../cm/workingObjectComment';
import { readWorkspaceGlance } from '../cm/workspaceGlance';
import { resolveWorkspaceRepositories } from '../cm/workspaceRepositories';
import { CmError } from '../cm/CmError';
import { checkNewWorkspaceFolder } from '../files/newWorkspaceFolder';
import { callerId } from '../ipc/caller';
import { readWorkspaceHeads } from '../workspace/selectorFile';
import { readSwitchPreflight } from '../workspace/switchPreflight';
import { switchWithChanges } from '../workspace/switchWithChanges';
import type { ServiceContext, SwitchContext } from './ServiceContext';

const UPDATE_NEEDS_MERGE = 'Some of your local changes collide with incoming ones. Open Incoming to merge them while updating.';

export function createWorkspacesService({ cm, operations, watchers, settings, headers }: ServiceContext, { switchShelves, leftChanges }: SwitchContext): WorkspacesApi {
  const switchDependencies = { cm, settings, records: switchShelves, leftChanges, backupsRoot: join(app.getPath('userData'), 'switch-backups') };
  /** Folders `create` made (they didn't exist or were empty): the only ones `discardNew` may delete. */
  const createdFolders = new Set<string>();

  async function list(): Promise<WorkspaceSummary[]> {
    const output = await cm.query(['workspace', 'list', `--format=${recordFormat(['wkname', 'path', 'wkid'])}`]);
    const workspaces = parseRecords(output).map(([name = '', path = '', guid = '']) => ({ name, path, guid }));
    // The client registry can list the same workspace several times; show each folder once.
    return [...new Map(workspaces.map((workspace) => [workspace.path, workspace])).values()];
  }

  async function info(workspacePath: string): Promise<WorkspaceInfo> {
    const [status, { name }] = await Promise.all([headers.status(workspacePath), headers.names(workspacePath)]);

    return {
      name,
      path: workspacePath,
      repository: `${status.repositoryName}@${status.server}`,
      ...status,
    };
  }

  async function findRoot(directory: string): Promise<string | null> {
    try {
      const output = await cm.query(['getworkspacefrompath', directory, '--format={wkpath}']);
      return output.trim() || null;
    } catch {
      return null;
    }
  }

  async function create(request: CreateWorkspaceRequest): Promise<WorkspaceSummary> {
    const madeHere = (await checkNewWorkspaceFolder(request.path)) === 'available';
    await cm.query(['workspace', 'create', request.name, request.path, request.repository]);
    if (madeHere) createdFolders.add(request.path);
    const created = (await list()).find((workspace) => workspace.name === request.name);
    if (!created) throw new Error(`Workspace ${request.name} was not found after creating it.`);
    return created;
  }

  async function rename(workspacePath: string, newName: string): Promise<void> {
    const currentName = (await info(workspacePath)).name;
    await cm.query(['workspace', 'rename', currentName, newName]);
    headers.forget(workspacePath);
  }

  async function remove(workspacePath: string): Promise<void> {
    await cm.query(['workspace', 'delete', workspacePath]);
  }

  function update(workspacePath: string, operationId: string): Promise<void> {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      try {
        await cm.execute(UPDATE_ARGS, { cwd: workspacePath, signal, onOutputLine: progressOf(readUpdateProgress) });
      } catch (error) {
        if (error instanceof CmError && error.message.includes('--dontmerge')) throw error.withMessage(UPDATE_NEEDS_MERGE);
        throw error;
      }
    });
  }

  async function watch(workspacePath: string): Promise<WatchCoverage> {
    cm.warmUp(workspacePath);
    return watchers.watch(callerId(), workspacePath);
  }

  function switchNewWorkspace(workspacePath: string, targetSpec: string, operationId: string): Promise<void> {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      await cm.execute(switchArgs(targetSpec), { cwd: workspacePath, signal, onOutputLine: progressOf(readUpdateProgress) });
    });
  }

  async function discardNew(workspacePath: string): Promise<void> {
    await cm.query(['workspace', 'delete', workspacePath]);
    if (!createdFolders.delete(workspacePath)) return;
    await rm(workspacePath, { recursive: true, force: true });
  }

  function repositoriesOf(workspacePaths: string[], lookupId: string): Promise<Record<string, string | null>> {
    return operations.read(lookupId, ({ signal }) => resolveWorkspaceRepositories(cm, workspacePaths, signal));
  }

  return {
    list,
    info,
    workingObjectComment: (workspacePath, selector) => readWorkingObjectComment(cm, workspacePath, selector),
    repositoriesOf,
    heads: readWorkspaceHeads,
    findMissing: async (paths) => paths.filter((path) => !existsSync(path)),
    findRoot,
    create,
    rename,
    remove,
    update,
    watch,
    unwatch: async () => watchers.release(callerId()),
    glance: (workspacePath) => readWorkspaceGlance(cm, workspacePath),
    checkNewFolder: checkNewWorkspaceFolder,
    switchNewWorkspace,
    discardNew,
    switchPreflight: (workspacePath, targetSpec) => readSwitchPreflight(cm, switchShelves, workspacePath, targetSpec),
    switchTo: (workspacePath, targetSpec, operationId, pendingChanges) =>
      operations.run(operationId, (context) => switchWithChanges(switchDependencies, workspacePath, targetSpec, pendingChanges, context)),
  };
}
