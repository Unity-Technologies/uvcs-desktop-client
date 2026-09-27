import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { dialog, shell } from 'electron';
import type { ExplorerApi } from '@shared/api/explorer';
import type { RevisionType } from '@shared/domain/explorer';
import { parseItemDetails } from '../cm/itemDetailsXml';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { parseTreeItems } from '../cm/treeItemsXml';
import { listWorkspacePaths } from '../files/listWorkspacePaths';
import { renamePrivate } from '../files/renamePrivate';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createExplorerService({ cm }: ServiceContext): ExplorerApi {
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
    await cm.query(['move', ...absolute(workspacePath, [fromPath, toPath])], inWorkspace(workspacePath));
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

  async function saveRevisionAs(workspacePath: string, revisionId: number, fileName: string) {
    const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: fileName });
    if (canceled || !filePath) return false;
    await downloadRevision(workspacePath, revisionId, filePath);
    return true;
  }

  async function openRevision(workspacePath: string, revisionId: number, fileName: string) {
    const directory = join(tmpdir(), 'uvcs-revisions', String(revisionId));
    await mkdir(directory, { recursive: true });
    const filePath = join(directory, fileName);
    await downloadRevision(workspacePath, revisionId, filePath);
    const error = await shell.openPath(filePath);
    if (error) throw new Error(error);
  }

  async function downloadRevision(workspacePath: string, revisionId: number, filePath: string) {
    await cm.query(['cat', `revid:${revisionId}`, `--file=${filePath}`], inWorkspace(workspacePath));
  }

  return {
    listDirectory,
    listRepositoryDirectory,
    listAllPaths: listWorkspacePaths,
    details,
    addRecursive,
    move,
    renamePrivate: renameItemOnDisk,
    create,
    changeRevisionType,
    saveRevisionAs,
    openRevision,
  };
}
