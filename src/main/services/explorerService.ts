import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ExplorerApi } from '@shared/api/explorer';
import type { ItemMove, RevisionType } from '@shared/domain/explorer';
import { parseItemDetails } from '../cm/itemDetailsXml';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { parseTreeItems } from '../cm/treeItemsXml';
import { listWorkspacePaths } from '../files/listWorkspacePaths';
import { moveArgs, moveItems } from '../files/moveItems';
import { renamePrivate } from '../files/renamePrivate';
import { toAbsolutePath } from '../files/workspacePaths';
import { revisionFiles } from './revisionFiles';
import type { ServiceContext } from './ServiceContext';

export function createExplorerService({ cm, operations }: ServiceContext): ExplorerApi {
  const revisions = revisionFiles(cm);
  const inWorkspace = (workspacePath: string) => ({ cwd: workspacePath });
  const absolute = (workspacePath: string, paths: string[]) => paths.map((path) => toAbsolutePath(workspacePath, path));

  async function listDirectory(workspacePath: string, directory: string) {
    const xml = await cm.query(onLinksThemselves('ls', toAbsolutePath(workspacePath, directory), '--xml'), inWorkspace(workspacePath));
    return parseTreeItems(xml);
  }

  async function listRepositoryDirectory(workspacePath: string, changesetId: number, directory: string) {
    const xml = await cm.query(['ls', `/${directory}`, `--tree=cs:${changesetId}`, '--xml'], inWorkspace(workspacePath));
    return parseTreeItems(xml);
  }

  async function details(workspacePath: string, path: string) {
    const xml = await cm.query(onLinksThemselves('fileinfo', toAbsolutePath(workspacePath, path), '--xml'), inWorkspace(workspacePath));
    return parseItemDetails(xml);
  }

  async function addRecursive(workspacePath: string, paths: string[]) {
    await cm.query(['add', '-R', '--coparent', ...absolute(workspacePath, paths)], inWorkspace(workspacePath));
  }

  async function move(workspacePath: string, fromPath: string, toPath: string) {
    await cm.query(moveArgs(workspacePath, { from: fromPath, to: toPath }), inWorkspace(workspacePath));
  }

  function moveItemsInto(workspacePath: string, moves: ItemMove[], operationId: string) {
    const mover = { cm: (args: string[]) => cm.query(args, inWorkspace(workspacePath)), renamePrivate };
    return operations.run(operationId, (context) => moveItems(workspacePath, moves, mover, context));
  }

  async function renameItemOnDisk(workspacePath: string, fromPath: string, toPath: string) {
    await renamePrivate(toAbsolutePath(workspacePath, fromPath), toAbsolutePath(workspacePath, toPath));
  }

  async function create(workspacePath: string, path: string, kind: 'file' | 'directory') {
    const absolutePath = toAbsolutePath(workspacePath, path);
    // Folders typed along with the name (`docs/intro.md`) are created too; `cm add` adds them with the item.
    await mkdir(dirname(absolutePath), { recursive: true });
    if (kind === 'directory') await mkdir(absolutePath);
    else await writeFile(absolutePath, '', { flag: 'wx' });
    await cm.query(['add', '--coparent', absolutePath], inWorkspace(workspacePath));
  }

  async function changeRevisionType(workspacePath: string, paths: string[], type: RevisionType) {
    await cm.query(['changerevisiontype', ...absolute(workspacePath, paths), `--type=${type}`], inWorkspace(workspacePath));
  }

  return {
    listDirectory,
    listRepositoryDirectory,
    listAllPaths: listWorkspacePaths,
    details,
    addRecursive,
    move,
    renamePrivate: renameItemOnDisk,
    moveItems: moveItemsInto,
    create,
    changeRevisionType,
    saveRevisionAs: async (workspacePath, revision, fileName) => (await revisions.saveAs(workspacePath, revision, fileName)) !== null,
    openRevision: revisions.open,
  };
}
