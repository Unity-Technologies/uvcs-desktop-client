// A workspace folder's children as the revisions the workspace loaded: `cm ls <folder> --format=…` of the workspace
// itself, what tells whether its disk holds a revision a view reads (`WorkspaceCopies`). It reads the workspace's
// metadata, not the files' content; `cm` still asks the server for the branches of what it lists (one call for all),
// and for their GUIDs only when they are printed, which this format doesn't.

import type { RevisionFile } from '../files/WorkspaceCopies';
import { parseRecords, recordFormat } from './formatRecords';
import { onLinksThemselves } from './symlinkArgs';
import { listedRevisionId } from './treeItems';

const FIELDS = ['wkpath', 'type', 'revid', 'hash', 'size', 'repspec'];

/** `cm ls` of a workspace folder, by its absolute path: the folder and its children, links as themselves. */
export function workspaceListingArgs(absoluteFolder: string): string[] {
  return onLinksThemselves('ls', absoluteFolder, `--format=${recordFormat(FIELDS)}`);
}

/**
 * The listed files with the revision each was loaded from, and its size and hash (the revision's, even where the file
 * changed since). Never a folder, a checkout (revision -1, the disk's hash) or a private file (no revision).
 */
export function parseWorkspaceListing(output: string): RevisionFile[] {
  return parseRecords(output).flatMap(([wkPath = '', type = '', revid = '', hash = '', size = '', repository = '']) => {
    const revisionId = listedRevisionId(revid);
    if ((type !== 'txt' && type !== 'bin') || revisionId === undefined || revisionId <= 0 || hash === '') return [];
    return [{ path: wkPath.replaceAll('\\', '/'), revision: { revisionId, repository: repository.replace(/^rep:/, '') }, hash, size: size === '' ? -1 : Number(size) }];
  });
}
