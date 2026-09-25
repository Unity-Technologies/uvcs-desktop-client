import type { PendingChange } from '@shared/domain/pendingChanges';
import { categoryOf } from './changeCategories';

/** More private files than this in one check-in is rarely on purpose: build output, caches, generated code. */
export const BULK_PRIVATE_FILES = 50;

/** Folder names that tools fill with output nobody checks in. Including one of these asks first, whatever its size. */
const GENERATED_FOLDERS = new Set(['bin', 'obj', 'gen', 'build', 'out', 'dist', 'node_modules', 'library', 'temp', 'logs', '.vs', '.idea']);

const NAMED_FOLDERS = 2;

/** Many private files about to be checked in, and the folders holding most of them. */
export interface BulkPrivate {
  fileCount: number;
  /** The outermost private folders (else the folders) holding the files, most files first. */
  folders: string[];
  /** Every included private item, folders too: what "Exclude private files" leaves out. */
  changes: PendingChange[];
}

/** The private files among the included changes when there are too many, or when a generated folder is included whole. */
export function bulkPrivateFiles(included: PendingChange[]): BulkPrivate | null {
  const privateChanges = included.filter((change) => categoryOf(change) === 'private');
  const privateFolders = new Set(privateChanges.filter((change) => change.itemType === 'directory').map((change) => change.path));
  const files = privateChanges.filter((change) => change.itemType !== 'directory');
  const generatedFolderIncluded = [...privateFolders].some((path) => GENERATED_FOLDERS.has(nameOf(path).toLowerCase()));
  if (files.length <= BULK_PRIVATE_FILES && !generatedFolderIncluded) return null;

  const filesPerFolder = new Map<string, number>();
  for (const file of files) {
    const folder = outermostPrivateFolder(file.path, privateFolders) ?? parentOf(file.path);
    if (folder) filesPerFolder.set(folder, (filesPerFolder.get(folder) ?? 0) + 1);
  }
  const folders = [...filesPerFolder].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b)).map(([folder]) => folder);
  return { fileCount: files.length, folders, changes: privateChanges };
}

/** "3,000 private files are included (gen/, obj/…)". */
export function bulkPrivateMessage({ fileCount, folders }: BulkPrivate): string {
  const named = folders.slice(0, NAMED_FOLDERS).map((folder) => `${folder}/`);
  const where = named.length === 0 ? '' : ` (${named.join(', ')}${folders.length > NAMED_FOLDERS ? '…' : ''})`;
  return `${fileCount.toLocaleString('en-US')} private ${fileCount === 1 ? 'file is' : 'files are'} included${where}`;
}

function outermostPrivateFolder(path: string, privateFolders: ReadonlySet<string>): string | undefined {
  const parts = path.split('/');
  for (let length = 1; length < parts.length; length++) {
    const folder = parts.slice(0, length).join('/');
    if (privateFolders.has(folder)) return folder;
  }
  return undefined;
}

function parentOf(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')));
}

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
