import { existsSync } from 'node:fs';
import { copyFile, writeFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import type { ContentSource } from '@shared/domain/content';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { removedItemSpec } from '../cm/removedItemSpec';
import { parseTreeItems } from '../cm/treeItemsXml';
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
      return saveRevision(cm, workspacePath, spec.revision(source.revision), target);
    case 'repositoryPath':
      return saveRepositoryPath(cm, workspacePath, source.path, source.at, target);
    case 'spec':
      return saveRevision(cm, workspacePath, source.spec, target);
  }
}

async function saveLoadedRevision(cm: CmClient, workspacePath: string, path: string, target: string): Promise<void> {
  const absolutePath = toAbsolutePath(workspacePath, path);
  const byPath = () => saveRevision(cm, workspacePath, absolutePath, target);
  const throughFolder = () => saveRemovedItemRevision(cm, workspacePath, absolutePath, target);
  // A file gone from disk was most likely removed: its folder first, so no `cm cat` fails (in red, in the command log).
  if (existsSync(absolutePath)) await withFallback(byPath, throughFolder);
  else await withFallback(throughFolder, byPath);
}

/** `cm rm` takes the item out of the workspace tree, so its path stops resolving: it is found through its folder. */
async function saveRemovedItemRevision(cm: CmClient, workspacePath: string, absolutePath: string, target: string): Promise<void> {
  const xml = await cm.query(['fileinfo', dirname(absolutePath), absolutePath, '--xml'], { cwd: workspacePath });
  const removed = removedItemSpec(xml, basename(absolutePath));
  // Nothing loaded (an added file, or one the branch deleted): its loaded version is empty.
  await (removed ? saveRevision(cm, workspacePath, removed, target) : writeFile(target, ''));
}

/** Runs `first`, then `fallback` if it fails; when both fail, `first`'s error is the one reported. */
async function withFallback(first: () => Promise<void>, fallback: () => Promise<void>): Promise<void> {
  try {
    await first();
  } catch (error) {
    await fallback().catch(() => {
      throw error;
    });
  }
}

/**
 * `serverpath:` reads the path in the repository's own tree, where an xlink is a leaf: nothing under one is found.
 * Then the changeset's tree, which `cm ls` walks through xlinks (nested ones too), names the file's revision in the
 * xlinked repository. A shelve has no such tree (`--tree` takes changesets): its paths are read as they are.
 */
async function saveRepositoryPath(cm: CmClient, workspacePath: string, path: string, at: string, target: string): Promise<void> {
  try {
    await saveRevision(cm, workspacePath, spec.serverPathAt(path, at), target);
  } catch (error) {
    const listed = at.startsWith('cs:') ? await cm.query(['ls', path, `--tree=${at}`, '--xml'], { cwd: workspacePath }).catch(() => '') : '';
    const item = listed && parseTreeItems(listed).find((candidate) => `/${candidate.path}` === path);
    if (!item || item.revisionId < 0) throw error;
    await saveRevision(cm, workspacePath, spec.revision(item), target);
  }
}

async function saveRevision(cm: CmClient, workspacePath: string, revisionSpec: string, target: string): Promise<void> {
  await cm.query(['cat', revisionSpec, `--file=${target}`], { cwd: workspacePath });
}
