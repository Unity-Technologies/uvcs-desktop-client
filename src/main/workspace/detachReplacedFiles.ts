import { lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CmClient } from '../cm/CmClient';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { waitForNextSecond } from '../files/nextSecond';
import { toAbsolutePath } from '../files/workspacePaths';
import { readPendingChanges } from './readPendingChanges';

/**
 * A merge from a shelve loads the shelve's revisions of the files it brings, which are gone once the shelve is
 * deleted: reading the file's base (its diff) would then fail. Kept, each file diffs against the shelve's revision and
 * shows no change at all. It "replaces" the files the workspace has, and "copies" back the ones the destination deleted
 * (a change kept over a deletion). Once that merge is done, replaced files become plain checkouts with the same content
 * (links with the same target), and copied ones plain added files. Only right after that merge: every replaced or
 * copied file comes from it.
 */
export async function detachReplacedFiles(cm: CmClient, workspacePath: string): Promise<void> {
  const { changes } = await readPendingChanges(cm, workspacePath, ['--controlledchanged']);
  const detached = changes.filter((change) => (change.kinds.includes('replaced') || change.kinds.includes('copied')) && !change.kinds.includes('moved') && change.itemType !== 'directory');
  if (detached.length === 0) return;
  const items = await Promise.all(
    detached.map(async (change) => {
      const path = toAbsolutePath(workspacePath, change.path);
      return { path, link: await isLink(path), copied: !change.kinds.includes('replaced') };
    }),
  );

  // A link's content is where it points: reading or writing the file would go through to its target.
  const contents = await Promise.all(items.map((item) => (item.link ? readlink(item.path) : readFile(item.path))));
  // Undoing a copied file takes it off the disk; a replaced one gets the loaded revision back.
  await cm.query(onLinksThemselves('undo', ...items.map((item) => item.path)), { cwd: workspacePath });
  // In a later second than the undo wrote them: rewritten with as many bytes within that second, they'd look unchanged.
  await waitForNextSecond();
  await Promise.all(items.map((item, index) => (item.link ? relink(item.path, contents[index] as string) : rewrite(item.path, contents[index] as Buffer))));
  const replaced = items.filter((item) => !item.copied).map((item) => item.path);
  const copied = items.filter((item) => item.copied).map((item) => item.path);
  if (replaced.length > 0) await cm.query(onLinksThemselves('checkout', ...replaced), { cwd: workspacePath });
  if (copied.length > 0) await cm.query(['add', ...copied], { cwd: workspacePath });
}

/** `cm status` records don't tell a link from a file: the disk does. */
async function isLink(path: string): Promise<boolean> {
  return lstat(path).then(
    (stats) => stats.isSymbolicLink(),
    () => false,
  );
}

async function rewrite(path: string, content: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

/**
 * Made next to it, then moved in place: Windows creates links only for administrators and in Developer Mode, and a
 * link that can't be made leaves the one the undo restored.
 */
async function relink(path: string, target: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const made = `${path}.uvcs-link`;
  await rm(made, { force: true });
  await symlink(target, made);
  await rename(made, path);
}
