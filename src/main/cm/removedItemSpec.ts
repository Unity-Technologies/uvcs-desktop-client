import { child, children, integer, parseXml, text } from './parseXml';

/**
 * A `cm cat` spec for the loaded revision of an item removed with `cm rm`, which its workspace path no longer
 * resolves. Reads `cm fileinfo --xml` of the item's parent directory and of the item, in that order: the parent says
 * which repository the item lives in and where (the children of an xlink live at the root of the xlinked repository;
 * folders under an xlink report paths in it), and the item the changeset of its loaded revision. Null when the item has
 * none (changeset -1: added, or not loaded, like a file the branch deleted), so no `#cs:-1` spec is ever asked for.
 */
export function removedItemSpec(fileinfoXml: string, name: string): string | null {
  const [parent, item] = children(child(parseXml(fileinfoXml, ['FileInfo']), 'FileInfos'), 'FileInfo');
  if (!parent || !item) throw new Error('cm fileinfo returned no information for the removed item.');

  const changeset = integer(item.RevisionChangeset);
  if (changeset < 0) return null;
  const directory = text(parent.IsXlink) === 'true' ? '' : text(parent.ServerPath).replace(/\/$/, '');
  return `serverpath:${directory}/${name}#cs:${changeset}@${text(parent.RepSpec)}`;
}
