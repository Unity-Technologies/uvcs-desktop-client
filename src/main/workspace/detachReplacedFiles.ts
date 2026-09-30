import { mkdir, readFile, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CmClient } from '../cm/CmClient';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { waitForNextSecond } from '../files/nextSecond';
import { toAbsolutePath } from '../files/workspacePaths';

/**
 * A merge from a shelve loads the shelve's revisions of the files it brings, which are gone once the shelve is
 * deleted: reading the file's base (its diff) would then fail. Kept, each file diffs against the shelve's revision and
 * shows no change at all. It "replaces" the files the workspace has, and "copies" back the ones the destination deleted
 * (a change kept over a deletion). Once that merge is done, replaced files become plain checkouts with the same content
 * (links with the same target), and copied ones plain added files. Only right after that merge: every replaced or
 * copied file comes from it.
 */
export async function detachReplacedFiles(cm: CmClient, workspacePath: string): Promise<void> {
  const { changes } = parsePendingChanges(await cm.query(['status', '--xml', '--controlledchanged'], { cwd: workspacePath }));
  const items = changes
    .filter((change) => (change.kinds.includes('replaced') || change.kinds.includes('copied')) && !change.kinds.includes('moved') && change.itemType !== 'directory')
    .map((change) => ({ path: toAbsolutePath(workspacePath, change.path), link: change.itemType === 'symlink', copied: !change.kinds.includes('replaced') }));
  if (items.length === 0) return;

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
