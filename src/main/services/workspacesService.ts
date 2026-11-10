import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import type { CreateWorkspaceRequest, WatchCoverage, WorkspacesApi } from '@shared/api/workspaces';
import type { WorkspaceInfo, WorkspaceSummary } from '@shared/domain/workspace';
import { recordFormat } from '../cm/formatRecords';
import { partialConfigureArgs } from '../cm/partialWorkspace';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { switchArgs, UPDATE_ARGS } from '../cm/updateArgs';
import { readWorkingObjectComment } from '../cm/workingObjectComment';
import { readWorkspaceGlance } from '../cm/workspaceGlance';
import { workspaceCreateArgs } from '../cm/workspaceCreateArgs';
import { workspaceHeadsReader } from '../cm/workspaceHeads';
import { workspaceKindsReader } from '../cm/workspaceKinds';
import { workspaceReadTurns } from '../cm/workspaceReadTurns';
import { workspaceRepositoryLookup } from '../cm/workspaceRepositories';
import { findWorkspaceRoot } from '../cm/workspaceRoot';
import { locateInWorkspace } from '../links/locateInWorkspace';
import { CmError } from '../cm/CmError';
import { checkNewWorkspaceFolder } from '../files/newWorkspaceFolder';
import { callerId } from '../ipc/caller';
import { readTrayRuns } from '../system/uvcsTray';
import { readSwitchPreflight } from '../workspace/switchPreflight';
import { switchWithChanges } from '../workspace/switchWithChanges';
import type { ServiceContext, SwitchContext } from './ServiceContext';

const UPDATE_NEEDS_MERGE = 'Some of your local changes collide with incoming ones. Open Incoming to merge them while updating.';

export function createWorkspacesService({ cm, operations, watchers, windows, settings, headers }: ServiceContext, { switchShelves, leftChanges }: SwitchContext): WorkspacesApi {
  const switchDependencies = { cm, settings, records: switchShelves, leftChanges, backupsRoot: join(app.getPath('userData'), 'switch-backups') };
  const lookUpRepository = workspaceRepositoryLookup(cm);
  // The heads and the kinds of the listed workspaces read one workspace at a time between them, so one pooled shell stays free.
  const listedReadTurns = workspaceReadTurns();
  const readHeads = workspaceHeadsReader(cm, listedReadTurns);
  const readKinds = workspaceKindsReader(cm, listedReadTurns);
  /** Folders `create` made (they didn't exist or were empty): the only ones `discardNew` may delete. */
  const createdFolders = new Set<string>();

  async function list(): Promise<WorkspaceSummary[]> {
    const args = ['workspace', 'list', `--format=${recordFormat(['wkname', 'path', 'wkid'])}`];
    const workspaces = await cm.queryRecords(args, ([name = '', path = '', guid = '']) => ({ name, path, guid }), { anyDirectory: true });
    // The client registry can list the same workspace several times; show each folder once.
    return [...new Map(workspaces.map((workspace) => [workspace.path, workspace])).values()];
  }

  async function info(workspacePath: string): Promise<WorkspaceInfo> {
    const [status, { name, kind }] = await Promise.all([headers.status(workspacePath), headers.names(workspacePath)]);

    return {
      name,
      path: workspacePath,
      repository: `${status.repositoryName}@${status.server}`,
      ...status,
      kind,
    };
  }

  async function create(request: CreateWorkspaceRequest): Promise<WorkspaceSummary> {
    const madeHere = (await checkNewWorkspaceFolder(request.path)) === 'available';
    const args = workspaceCreateArgs(request);
    // A dynamic workspace's create waits for its file system to mount it (up to 30 s): a process, not a pooled shell.
    await (request.dynamic ? cm.execute(args) : cm.query(args));
    if (madeHere) createdFolders.add(request.path);
    const created = (await list()).find((workspace) => workspace.name === request.name);
    if (!created) throw new Error(`Workspace ${request.name} was not found after creating it.`);
    return created;
  }

  async function rename(workspacePath: string, newName: string): Promise<void> {
    const { name } = await headers.names(workspacePath);
    await cm.query(['workspace', 'rename', name, newName]);
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

  /**
   * A window shows the workspace: its `cm shell`s start, and the home folder's go once no window shows the home screen,
   * instead of idling for minutes; they served the home screen this window may have come from. Unless a window, this
   * one or another, shows a workspace in the home folder itself: those shells are its own. The page windows it opened
   * on another workspace close.
   */
  async function watch(workspacePath: string): Promise<WatchCoverage> {
    cm.show(workspacePath);
    windows.workspaceShown(callerId(), workspacePath);
    const coverage = watchers.watch(callerId(), workspacePath);
    const home = homedir();
    if (!windows.showsHomeScreen() && watchers.coverageOf(home) === undefined) cm.release(home);
    return coverage;
  }

  function switchNewWorkspace(workspacePath: string, targetSpec: string, operationId: string): Promise<void> {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      await cm.execute(switchArgs(targetSpec), { cwd: workspacePath, signal, onOutputLine: progressOf(readUpdateProgress) });
    });
  }

  function configurePartial(workspacePath: string, folders: string[], operationId: string): Promise<void> {
    return operations.run(operationId, async ({ signal }) => {
      await cm.execute(partialConfigureArgs(folders), { cwd: workspacePath, signal });
    });
  }

  async function discardNew(workspacePath: string): Promise<void> {
    await cm.query(['workspace', 'delete', workspacePath]);
    if (!createdFolders.delete(workspacePath)) return;
    // Windows keeps files the watcher or a scan still holds for a moment.
    await rm(workspacePath, { recursive: true, force: true, maxRetries: 5 });
  }

  function repositoryOf(workspacePath: string, lookupId: string): Promise<string | null> {
    return operations.read(lookupId, ({ signal }) => lookUpRepository(workspacePath, signal));
  }

  return {
    list,
    info,
    workingObjectComment: (workspacePath, selector) => readWorkingObjectComment(cm, workspacePath, selector),
    repositoryOf,
    heads: readHeads,
    kinds: readKinds,
    findMissing: async (paths) => paths.filter((path) => !existsSync(path)),
    findRoot: (directory) => findWorkspaceRoot(cm, directory),
    locate: (path) => locateInWorkspace(path, { findRoot: (target) => findWorkspaceRoot(cm, target) }),
    canCreateDynamic: () => readTrayRuns(process.platform),
    create,
    rename,
    remove,
    update,
    watch,
    unwatch: async () => {
      windows.workspaceShown(callerId(), undefined);
      watchers.release(callerId());
    },
    glance: (workspacePath) => readWorkspaceGlance(cm, workspacePath),
    checkNewFolder: checkNewWorkspaceFolder,
    switchNewWorkspace,
    configurePartial,
    discardNew,
    switchPreflight: (workspacePath, targetSpec) => readSwitchPreflight(cm, switchShelves, workspacePath, targetSpec),
    switchTo: (workspacePath, targetSpec, operationId, pendingChanges) =>
      operations.run(operationId, (context) => switchWithChanges(switchDependencies, workspacePath, targetSpec, pendingChanges, context)),
  };
}
