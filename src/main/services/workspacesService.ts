import type { CreateWorkspaceRequest, WatchCoverage, WorkspacesApi } from '@shared/api/workspaces';
import type { WorkspaceInfo, WorkspaceSummary } from '@shared/domain/workspace';
import { parseRecords, recordFormat } from '../cm/formatRecords';
import { resolveWorkspaceRepositories } from '../cm/workspaceRepositories';
import { readWorkspaceStatus } from '../cm/workspaceStatus';
import { CmError } from '../cm/CmError';
import type { ServiceContext } from './ServiceContext';

const UPDATE_NEEDS_MERGE = 'Some of your local changes collide with incoming ones. Open Incoming to merge them while updating.';

export function createWorkspacesService({ cm, operations, watcher }: ServiceContext): WorkspacesApi {
  async function list(): Promise<WorkspaceSummary[]> {
    const output = await cm.query(['workspace', 'list', `--format=${recordFormat(['wkname', 'path', 'wkid'])}`]);
    const workspaces = parseRecords(output).map(([name = '', path = '', guid = '']) => ({ name, path, guid }));
    // The client registry can list the same workspace several times; show each folder once.
    return [...new Map(workspaces.map((workspace) => [workspace.path, workspace])).values()];
  }

  async function info(workspacePath: string): Promise<WorkspaceInfo> {
    const [status, nameOutput] = await Promise.all([
      readWorkspaceStatus(cm, workspacePath),
      cm.query(['getworkspacefrompath', workspacePath, '--format={wkname}'], { cwd: workspacePath }),
    ]);

    return {
      name: nameOutput.trim(),
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
    await cm.query(['workspace', 'create', request.name, request.path, request.repository]);
    const created = (await list()).find((workspace) => workspace.name === request.name);
    if (!created) throw new Error(`Workspace ${request.name} was not found after creating it.`);
    return created;
  }

  async function rename(workspacePath: string, newName: string): Promise<void> {
    const currentName = (await info(workspacePath)).name;
    await cm.query(['workspace', 'rename', currentName, newName]);
  }

  async function remove(workspacePath: string): Promise<void> {
    await cm.query(['workspace', 'delete', workspacePath]);
  }

  function update(workspacePath: string, operationId: string): Promise<void> {
    return operations.run(operationId, async ({ signal, reportProgress }) => {
      // --dontmerge: never launch an external merge tool. Conflicts with local changes are resolved in the Incoming view.
      try {
        await cm.execute(['update', '--machinereadable', '--noinput', '--dontmerge'], {
          cwd: workspacePath,
          signal,
          onOutputLine: reportProgress,
        });
      } catch (error) {
        if (error instanceof CmError && error.message.includes('--dontmerge')) throw new Error(UPDATE_NEEDS_MERGE);
        throw error;
      }
    });
  }

  async function watch(workspacePath: string): Promise<WatchCoverage> {
    cm.warmUp(workspacePath);
    return watcher.watch(workspacePath);
  }

  function switchTo(workspacePath: string, targetSpec: string, operationId: string): Promise<void> {
    return operations.run(operationId, async ({ signal, reportProgress }) => {
      await cm.execute(['switch', targetSpec, '--noinput'], { cwd: workspacePath, signal, onOutputLine: reportProgress });
    });
  }

  function repositoriesOf(workspacePaths: string[], lookupId: string): Promise<Record<string, string | null>> {
    return operations.read(lookupId, ({ signal }) => resolveWorkspaceRepositories(cm, workspacePaths, signal));
  }

  return { list, info, repositoriesOf, findRoot, create, rename, remove, update, watch, switchTo };
}
