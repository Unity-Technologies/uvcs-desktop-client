/**
 * The one order of every list of changed files, flat or a tree, in every view: folder by folder, so everything in a
 * folder comes right after it. Comparing whole paths puts "a-b.txt" between "a" and "a/c.txt", and "src/b" between
 * "Src/a" and "Src/c".
 */
export function comparePaths(a: string, b: string): number {
  // Up to the first character they differ in, the folders are the same: only the names there are compared.
  let differ = 0;
  const shorter = Math.min(a.length, b.length);
  while (differ < shorter && a.charCodeAt(differ) === b.charCodeAt(differ)) differ++;
  if (differ === a.length && differ === b.length) return 0;
  const start = a.lastIndexOf('/', differ - 1) + 1;
  const order = compareNames(segmentAt(a, start), segmentAt(b, start));
  return order !== 0 ? order : compareSegments(a.split('/'), b.split('/'));
}

/**
 * Two names in one folder in `comparePaths` order. Different names the collator reads as the same ("v01" and "v1",
 * "café" composed and decomposed) are different folders: ordered by their code units, so neither's items slip in
 * between the other's.
 */
export function compareNames(a: string, b: string): number {
  const order = collator.compare(a, b);
  if (order !== 0 || a === b) return order;
  return a < b ? -1 : 1;
}

/** An item `sortByPath` sorts, by its last name, in the folder it is in. */
interface Named<T> {
  name: string;
  item?: T;
  folder?: Folder<T>;
}

/** A folder of the paths `sortByPath` sorts: the items right in it, and the folders below it by name. */
interface Folder<T> {
  items: Named<T>[];
  folders: Map<string, Folder<T>>;
}

/**
 * `items` in `comparePaths` order, sorted folder by folder: the names of each folder are compared among themselves
 * only, so a million paths in folders of 50 take about 6 million comparisons of names, where sorting the whole list
 * took 20 million comparisons of paths (2 s in the window, a list of pending changes read in no order).
 * `compare` orders two names of a folder; `compareNames` unless a test counts them.
 */
export function sortByPath<T>(items: readonly T[], pathOf: (item: T) => string, compare: (a: string, b: string) => number = compareNames): T[] {
  const root: Folder<T> = { items: [], folders: new Map() };
  const folders = new Map<string, Folder<T>>();
  const folderAt = (path: string): Folder<T> => {
    let folder = folders.get(path);
    if (!folder) {
      folder = { items: [], folders: new Map() };
      folders.set(path, folder);
      const slash = path.lastIndexOf('/');
      const parent = slash < 0 ? root : folderAt(path.slice(0, slash));
      parent.folders.set(path.slice(slash + 1), folder);
    }
    return folder;
  };
  for (const item of items) {
    const path = pathOf(item);
    const slash = path.lastIndexOf('/');
    (slash < 0 ? root : folderAt(path.slice(0, slash))).items.push({ name: path.slice(slash + 1), item });
  }
  const sorted: T[] = [];
  appendSorted(root, compare, sorted);
  return sorted;
}

/** Appends the folder's items and, right after each folder's name, what is in it. */
function appendSorted<T>(folder: Folder<T>, compare: (a: string, b: string) => number, sorted: T[]): void {
  const named = [...folder.items];
  for (const [name, below] of folder.folders) named.push({ name, folder: below });
  // An item named as a folder (the folder itself, changed) comes right before what is in it; stable otherwise.
  named.sort((a, b) => compare(a.name, b.name) || (a.folder ? 1 : 0) - (b.folder ? 1 : 0));
  for (const { item, folder: below } of named) {
    if (below) appendSorted(below, compare, sorted);
    else sorted.push(item as T);
  }
}

function segmentAt(path: string, start: number): string {
  const end = path.indexOf('/', start);
  return path.slice(start, end === -1 ? undefined : end);
}

function compareSegments(a: string[], b: string[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const order = collator.compare(a[index]!, b[index]!);
    if (order !== 0) return order;
  }
  return a.length - b.length;
}

/** Names as people read them: file_2 before file_10, case only between names otherwise equal. Faster than `localeCompare`. */
const collator = new Intl.Collator(undefined, { numeric: true });
