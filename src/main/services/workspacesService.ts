import type { CreateWorkspaceRequest, WorkspacesApi } from '@shared/api/workspaces';
import type { SelectorKind, WorkspaceInfo, WorkspaceSummary } from '@shared/domain/workspace';
import { parseRecords, recordFormat } from '../cm/formatRecords';
import { child, integer, parseXml, text } from '../cm/parseXml';
import { resolveWorkspaceRepositories } from '../cm/workspaceRepositories';
import type { ServiceContext } from './ServiceContext';

const SELECTOR_KINDS: Record<string, SelectorKind> = {
  Branch: 'branch',
  Changeset: 'changeset',
  Label: 'label',
  Shelve: 'shelve',
};

export function createWorkspacesService({ cm, operations, watcher }: ServiceContext): WorkspacesApi {
  async function list(): Promise<WorkspaceSummary[]> {
    const output = await cm.query(['workspace', 'list', `--format=${recordFormat(['wkname', 'path', 'wkid'])}`]);
    const workspaces = parseRecords(output).map(([name = '', path = '', guid = '']) => ({ name, path, guid }));
    // The client registry can list the same workspace several times; show each folder once.
    return [...new Map(workspaces.map((workspace) => [workspace.path, workspace])).values()];
  }

  async function info(workspacePath: string): Promise<WorkspaceInfo> {
    const [statusXml, nameOutput] = await Promise.all([
      cm.query(['status', '--header', '--xml'], { cwd: workspacePath }),
      cm.query(['getworkspacefrompath', workspacePath, '--format={wkname}']),
    ]);
    const status = child(parseXml(statusXml, []), 'StatusOutput');
    const workspaceStatus = child(child(status, 'WorkspaceStatus'), 'Status');
    const repSpec = child(workspaceStatus, 'RepSpec');
    const repositoryName = text(repSpec?.Name);
    const server = text(repSpec?.Server);
    const configName = text(status?.WkConfigName);

    return {
      name: nameOutput.trim(),
      path: workspacePath,
      repository: `${repositoryName}@${server}`,
      repositoryName,
      server,
      selector: {
        kind: SELECTOR_KINDS[text(status?.WkConfigType)] ?? 'branch',
        name: configName.slice(0, configName.lastIndexOf(`@${repositoryName}@`)) || configName,
      },
      loadedChangeset: integer(workspaceStatus?.Changeset),
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
      await cm.execute(['update', '--machinereadable', '--noinput'], {
        cwd: workspacePath,
        signal,
        onOutputLine: reportProgress,
      });
    });
  }

  async function watch(workspacePath: string): Promise<void> {
    watcher.watch(workspacePath);
  }

  function switchTo(workspacePath: string, targetSpec: string, operationId: string): Promise<void> {
    return operations.run(operationId, async ({ signal, reportProgress }) => {
      await cm.execute(['switch', targetSpec, '--noinput'], { cwd: workspacePath, signal, onOutputLine: reportProgress });
    });
  }

  return { list, info, repositoriesOf: (paths) => resolveWorkspaceRepositories(cm, paths), findRoot, create, rename, remove, update, watch, switchTo };
}
