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
  const order = collator.compare(segmentAt(a, start), segmentAt(b, start));
  // Names the collator takes as equal (other Unicode forms of the same text) leave it to the rest of the paths.
  return order !== 0 ? order : compareSegments(a.split('/'), b.split('/'));
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

/** `localeCompare`'s order, many times faster over thousands of paths. */
const collator = new Intl.Collator();
