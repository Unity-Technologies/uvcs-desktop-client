import { copyFile, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { ContentSource } from '@shared/domain/content';
import type { CmClient } from '../cm/CmClient';
import { removedItemSpec } from '../cm/removedItemSpec';
import { toAbsolutePath } from './workspacePaths';

/** A version of a file, as it is and whatever it holds, saved to `target`. Review snapshots are read elsewhere. */
export async function saveContent(cm: CmClient, workspacePath: string, source: Exclude<ContentSource, { kind: 'reviewSnapshot' }>, target: string): Promise<void> {
  switch (source.kind) {
    case 'empty':
      return writeFile(target, '');
    case 'workspaceFile':
      return copyFile(toAbsolutePath(workspacePath, source.path), target);
    case 'workspaceBase':
      return saveLoadedRevision(cm, workspacePath, source.path, target);
    case 'revision':
      return saveRevision(cm, workspacePath, `revid:${source.revisionId}`, target);
    case 'spec':
      return saveRevision(cm, workspacePath, source.spec, target);
  }
}

async function saveLoadedRevision(cm: CmClient, workspacePath: string, path: string, target: string): Promise<void> {
  const absolutePath = toAbsolutePath(workspacePath, path);
  try {
    await saveRevision(cm, workspacePath, absolutePath, target);
  } catch (error) {
    // `cm rm` takes the item out of the workspace tree, so its path stops resolving: find it through its folder.
    try {
      const xml = await cm.query(['fileinfo', dirname(absolutePath), absolutePath, '--xml'], { cwd: workspacePath });
      await saveRevision(cm, workspacePath, removedItemSpec(xml, basename(absolutePath)), target);
    } catch {
      throw error;
    }
  }
}

async function saveRevision(cm: CmClient, workspacePath: string, revisionSpec: string, target: string): Promise<void> {
  await cm.query(['cat', revisionSpec, `--file=${target}`], { cwd: workspacePath });
}
