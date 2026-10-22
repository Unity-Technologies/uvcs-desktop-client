import type { PendingChange } from '@shared/domain/pendingChanges';
import { compareNames } from '@shared/pathOrder';
import { parentOf } from '../../lib/paths';
import { fileNameOf, formatCount } from '../../lib/text';
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
  const generatedFolderIncluded = [...privateFolders].some((path) => GENERATED_FOLDERS.has(fileNameOf(path).toLowerCase()));
  if (files.length <= BULK_PRIVATE_FILES && !generatedFolderIncluded) return null;

  const filesPerFolder = new Map<string, number>();
  for (const file of files) {
    const folder = outermostPrivateFolder(file.path, privateFolders) ?? parentOf(file.path);
    if (folder) filesPerFolder.set(folder, (filesPerFolder.get(folder) ?? 0) + 1);
  }
  const folders = [...filesPerFolder].sort(([a, countA], [b, countB]) => countB - countA || compareNames(a, b)).map(([folder]) => folder);
  return { fileCount: files.length, folders, changes: privateChanges };
}

/**
 * Where each private item of a read is counted, worked out once for the read (`privateFoldersOf`) as if every private
 * folder went in: a check after it only counts (`BulkPrivateTally`), where `bulkPrivateFiles` looks for each file's
 * folder again, a million times a click.
 */
export interface PrivateFolders {
  /** What each change is: 0 no private item, 1 a private file, 2 a private folder, 3 a generated one (`GENERATED_FOLDERS`). */
  kindOf: Uint8Array;
  /** The folder each private file is counted in (an index of `names`); -1 for the rest, and a file at the root. */
  folderOf: Int32Array;
  /** The folders, in name order: ties in count keep it. */
  names: string[];
}

const NOT_PRIVATE = 0;
const PRIVATE_FILE = 1;
const PRIVATE_FOLDER = 2;
const GENERATED_FOLDER = 3;

export function privateFoldersOf(changes: readonly PendingChange[]): PrivateFolders {
  const kindOf = Uint8Array.from(changes, (change) => {
    if (categoryOf(change) !== 'private') return NOT_PRIVATE;
    if (change.itemType !== 'directory') return PRIVATE_FILE;
    return GENERATED_FOLDERS.has(fileNameOf(change.path).toLowerCase()) ? GENERATED_FOLDER : PRIVATE_FOLDER;
  });
  const privateFolders = new Set(changes.filter((_, index) => kindOf[index]! >= PRIVATE_FOLDER).map((change) => change.path));
  // Files share their parents: each parent's folder is looked for once.
  const folderOfParent = new Map<string, string>();
  const folderNames = changes.map((change, index) => {
    if (kindOf[index] !== PRIVATE_FILE) return '';
    const parent = parentOf(change.path);
    let folder = folderOfParent.get(parent);
    if (folder === undefined) {
      folder = outermostPrivateFolder(`${parent}/`, privateFolders) ?? parent;
      folderOfParent.set(parent, folder);
    }
    return folder;
  });
  const names = [...new Set(folderNames)].filter((name) => name !== '').sort(compareNames);
  const indexOf = new Map(names.map((name, index) => [name, index]));
  return { kindOf, folderOf: Int32Array.from(folderNames, (name) => indexOf.get(name) ?? -1), names };
}

/** Whether the change at `index` is a private folder: one left out counts its files in other folders than `folderOf`. */
export function isPrivateFolderAt(folders: PrivateFolders, index: number): boolean {
  return folders.kindOf[index]! >= PRIVATE_FOLDER;
}

/** `bulkPrivateFiles` of the changes added one by one, by their index in what `privateFoldersOf` read: counted only. */
export class BulkPrivateTally {
  private readonly perFolder: Int32Array;
  private readonly privateChanges: PendingChange[] = [];
  private fileCount = 0;
  private generatedFolderIncluded = false;

  constructor(private readonly folders: PrivateFolders) {
    this.perFolder = new Int32Array(folders.names.length);
  }

  add(change: PendingChange, index: number): void {
    const kind = this.folders.kindOf[index];
    if (kind === NOT_PRIVATE) return;
    this.privateChanges.push(change);
    if (kind === GENERATED_FOLDER) this.generatedFolderIncluded = true;
    if (kind !== PRIVATE_FILE) return;
    this.fileCount++;
    const folder = this.folders.folderOf[index]!;
    if (folder !== -1) this.perFolder[folder]!++;
  }

  result(): BulkPrivate | null {
    if (this.fileCount <= BULK_PRIVATE_FILES && !this.generatedFolderIncluded) return null;
    const counted = [...this.perFolder.keys()].filter((folder) => this.perFolder[folder]! > 0);
    const folders = counted.sort((a, b) => this.perFolder[b]! - this.perFolder[a]! || a - b).map((folder) => this.folders.names[folder]!);
    return { fileCount: this.fileCount, folders, changes: this.privateChanges };
  }
}

/** "3,000 private files are included (gen/, obj/…)". */
export function bulkPrivateMessage({ fileCount, folders }: BulkPrivate): string {
  const named = folders.slice(0, NAMED_FOLDERS).map((folder) => `${folder}/`);
  const where = named.length === 0 ? '' : ` (${named.join(', ')}${folders.length > NAMED_FOLDERS ? '…' : ''})`;
  return `${formatCount(fileCount)} private ${fileCount === 1 ? 'file is' : 'files are'} included${where}`;
}

function outermostPrivateFolder(path: string, privateFolders: ReadonlySet<string>): string | undefined {
  for (let end = path.indexOf('/'); end !== -1; end = path.indexOf('/', end + 1)) {
    const folder = path.slice(0, end);
    if (privateFolders.has(folder)) return folder;
  }
  return undefined;
}
