/** A run of a path's text: unchanged, or changed (removed from the old path, added in the new one). */
export interface PathPart {
  text: string;
  changed: boolean;
}

/** Where an item was and where it is now, each told as parts; joined, each gives its path back. */
export interface PathChange {
  old: PathPart[];
  new: PathPart[];
}

/** A folder with its separator (`src/`, `src\`, the root's `/`), or the last segment, which has none. */
const SEGMENT = /[^/\\]*[/\\]|[^/\\]+$/g;

/**
 * What a move changed, by whole segments (folders and the name, a renamed name changing whole): the folders both paths
 * start with and the segments both end with are unchanged, what lies between is changed in each, as the official
 * client shows moves (`merge/X.cs` to `merge/mergeto/X.cs` changes `mergeto/` only). Segments compare by name, in
 * one Unicode normalization (macOS may name a file in NFD that `cm` printed in NFC) and either separator.
 */
export function pathChangeSegments(oldPath: string, newPath: string): PathChange {
  const oldSegments = oldPath.match(SEGMENT) ?? [];
  const newSegments = newPath.match(SEGMENT) ?? [];
  const same = (oldIndex: number, newIndex: number): boolean => segmentName(oldSegments[oldIndex]!) === segmentName(newSegments[newIndex]!);

  const shorter = Math.min(oldSegments.length, newSegments.length);
  let start = 0;
  while (start < shorter && same(start, start)) start++;
  let end = 0;
  while (start + end < shorter && same(oldSegments.length - 1 - end, newSegments.length - 1 - end)) end++;

  return { old: partsOf(oldSegments, start, end), new: partsOf(newSegments, start, end) };
}

function segmentName(segment: string): string {
  return segment.replace(/[/\\]$/, '').normalize('NFC');
}

/** The segments as their unchanged start, the changed middle and the unchanged end, leaving out the empty ones. */
function partsOf(segments: string[], start: number, end: number): PathPart[] {
  const middleEnd = segments.length - end;
  // Nothing changed in this path (the other one gained folders): one unchanged part.
  const parts: PathPart[] =
    start === middleEnd
      ? [{ text: segments.join(''), changed: false }]
      : [
          { text: segments.slice(0, start).join(''), changed: false },
          { text: segments.slice(start, middleEnd).join(''), changed: true },
          { text: segments.slice(middleEnd).join(''), changed: false },
        ];
  return parts.filter((part) => part.text !== '');
}
