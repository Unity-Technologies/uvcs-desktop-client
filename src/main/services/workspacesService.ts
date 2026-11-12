import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { app } from 'electron';
import type { CreateWorkspaceRequest, WatchCoverage, WorkspacesApi } from '@shared/api/workspaces';
import type { PartialRule, WorkspaceInfo, WorkspaceSummary } from '@shared/domain/workspace';
import { recordFormat } from '../cm/formatRecords';
import { loadedItemsArgs, readLoadedItem } from '../cm/loadedItems';
import { EMPTY_PARTIAL_UPDATE_ARGS, partialConfigureArgs } from '../cm/partialWorkspace';
import { partialUpdateCommands, switchCommand, updateCommand, type ProgressingCommand } from '../cm/updateArgs';
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
import { kindFromHeaders } from '../workspace/shelveFlowDependencies';
import { readTrayRuns } from '../system/uvcsTray';
import { readSwitchPreflight } from '../workspace/switchPreflight';
import { switchWithChanges } from '../workspace/switchWithChanges';
import type { ServiceContext, SwitchContext } from './ServiceContext';

const UPDATE_NEEDS_MERGE = 'Some of your local changes collide with incoming ones. Open Incoming to merge them while updating.';

/**
 * `tellKindChanged` tells every window a workspace's kind changed, so the lists showing it read it again (the kind
 * they read once is kept for good: `workspaceKindQuery`).
 */
export function createWorkspacesService(
  { cm, operations, watchers, windows, settings, headers }: ServiceContext,
  { switchShelves, leftChanges }: SwitchContext,
  tellKindChanged: (workspacePath: string) => void,
): WorkspacesApi {
  const kindOf = kindFromHeaders(headers);
  const switchDependencies = { cm, settings, records: switchShelves, leftChanges, backupsRoot: join(app.getPath('userData'), 'switch-backups'), kindOf };
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
    await (request.kind === 'dynamic' ? cm.execute(args) : cm.query(args));
    if (madeHere) createdFolders.add(request.path);
    if (request.kind === 'partial') await markPartial(request.path);
    const created = (await list()).find((workspace) => workspace.name === request.name);
    if (!created) throw new Error(`Workspace ${request.name} was not found after creating it.`);
    return created;
  }

  /**
   * An update of the workspace's files, so a process of its own in it, as every partial command runs. If it fails, the
   * workspace would be a standard one with nothing downloaded, whose name and folder block creating it again: it goes.
   */
  async function markPartial(workspacePath: string): Promise<void> {
    try {
      await cm.execute([...EMPTY_PARTIAL_UPDATE_ARGS], { cwd: workspacePath });
    } catch (error) {
      await discardNew(workspacePath).catch(() => undefined);
      throw error;
    }
  }

  async function rename(workspacePath: string, newName: string): Promise<void> {
    const { name } = await headers.names(workspacePath);
    await cm.query(['workspace', 'rename', name, newName]);
    headers.forget(workspacePath);
  }

  async function remove(workspacePath: string): Promise<void> {
    await cm.query(['workspace', 'delete', workspacePath]);
  }

  /** `paths` (a partial workspace's) update one batch after the other: a stop leaves the later batches as they were. */
  function update(workspacePath: string, operationId: string, paths?: readonly string[]): Promise<void> {
    return operations.run(operationId, async ({ signal, progressOf }) => {
      try {
        const commands: ProgressingCommand[] = paths ? partialUpdateCommands(paths) : [updateCommand(await kindOf(workspacePath))];
        for (const { args, readProgress } of commands) {
          await cm.execute(args, { cwd: workspacePath, signal, onOutputLine: progressOf(readProgress) });
        }
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
      const { args, readProgress } = switchCommand(targetSpec, await kindOf(workspacePath));
      await cm.execute(args, { cwd: workspacePath, signal, onOutputLine: progressOf(readProgress) });
    });
  }

  /**
   * The first `cm partial configure` on a standard workspace makes it partial. A failure may come after it converted
   * it, so the windows are told its kind changed either way.
   */
  function configurePartial(workspacePath: string, rules: PartialRule[], operationId: string): Promise<void> {
    return operations.run(operationId, async ({ signal }) => {
      // The kind only decides whether to tell the window it may change (a local, cached read): a read that fails must
      // not stop the user's choice, and telling once too often only makes the window read the kind again.
      const converts = await kindOf(workspacePath).then(
        (kind) => kind === 'standard',
        () => true,
      );
      try {
        await cm.execute(partialConfigureArgs(rules), { cwd: workspacePath, signal });
      } finally {
        if (converts) tellKindChanged(workspacePath);
      }
    });
  }

  async function loadedIn(workspacePath: string, folder: string): Promise<string[]> {
    const items = await cm.queryRecords(loadedItemsArgs([join(workspacePath, folder)]), readLoadedItem, { cwd: workspacePath });
    // `cm ls` lists the folder itself first.
    return items.filter((item) => item.path !== folder).map((item) => item.path);
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
    loadedIn,
    discardNew,
    switchPreflight: (workspacePath, targetSpec) => readSwitchPreflight(cm, switchShelves, workspacePath, targetSpec),
    switchTo: (workspacePath, targetSpec, operationId, pendingChanges) =>
      operations.run(operationId, (context) => switchWithChanges(switchDependencies, workspacePath, targetSpec, pendingChanges, context)),
  };
}
