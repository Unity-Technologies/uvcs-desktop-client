import { diffArrays } from 'diff';

/** A stretch of the three-way merge: lines both sides agree on, or a conflict between what each side made of the base. */
export type Diff3Region = { ok: string[] } | { conflict: { a: string[]; o: string[]; b: string[] } };

/** Where one side differs from the base: base lines `[oStart, oStart + oLength)` became its lines `[start, start + length)`. */
interface Hunk {
  side: 'a' | 'b';
  oStart: number;
  oLength: number;
  start: number;
  length: number;
}

/**
 * Three-way merge of `a` and `b`, both derived from `o`, line by line, in the regions of the classic diff3 (as
 * node-diff3 and GNU diff3 draw them): changes on one side only are taken, changes to overlapping stretches of the
 * base conflict, unless both sides made the same one. Each side is diffed against the base with Myers' algorithm, the
 * one of the app's diffs, which takes time by the number of lines changed rather than the lines repeated: node-diff3's
 * Hunt–McIlroy took 85 s on a 20,000-line lockfile, whose lines repeat by the thousand.
 */
export function diff3Merge(a: string[], o: string[], b: string[]): Diff3Region[] {
  const regions: Diff3Region[] = [];
  let ok: string[] = [];
  const flushOk = (): void => {
    if (ok.length > 0) regions.push({ ok });
    ok = [];
  };

  // Sorted by where they start in the base; `a`'s first where both start at the same line, as node-diff3 does.
  const hunks = [...hunksOf(o, a, 'a'), ...hunksOf(o, b, 'b')].sort((x, y) => x.oStart - y.oStart);
  let offset = 0;
  for (let index = 0; index < hunks.length; ) {
    const first = hunks[index]!;
    const regionStart = first.oStart;
    let regionEnd = first.oStart + first.oLength;
    const region = [first];
    // Hunks that overlap (or touch) the region join it.
    for (index++; index < hunks.length && hunks[index]!.oStart <= regionEnd; index++) {
      const next = hunks[index]!;
      regionEnd = Math.max(regionEnd, next.oStart + next.oLength);
      region.push(next);
    }
    ok.push(...o.slice(offset, regionStart));

    if (region.length === 1) {
      ok.push(...(first.side === 'a' ? a : b).slice(first.start, first.start + first.length));
    } else {
      const aSpan = sideSpan(region, 'a', regionStart, regionEnd, a.length, o.length);
      const bSpan = sideSpan(region, 'b', regionStart, regionEnd, b.length, o.length);
      const aLines = a.slice(aSpan[0], aSpan[1]);
      const bLines = b.slice(bSpan[0], bSpan[1]);
      if (sameLines(aLines, bLines)) {
        ok.push(...aLines);
      } else {
        flushOk();
        regions.push({ conflict: { a: aLines, o: o.slice(regionStart, regionEnd), b: bLines } });
      }
    }
    offset = regionEnd;
  }
  ok.push(...o.slice(offset));
  flushOk();
  return regions;
}

function hunksOf(base: string[], other: string[], side: Hunk['side']): Hunk[] {
  const hunks: Hunk[] = [];
  const parts = diffArrays(base, other);
  let baseLine = 0;
  let otherLine = 0;
  for (let index = 0; index < parts.length; ) {
    const part = parts[index]!;
    if (!part.added && !part.removed) {
      baseLine += part.count;
      otherLine += part.count;
      index++;
      continue;
    }
    // A removal next to an addition is one change.
    const hunk: Hunk = { side, oStart: baseLine, oLength: 0, start: otherLine, length: 0 };
    for (; index < parts.length && (parts[index]!.added || parts[index]!.removed); index++) {
      if (parts[index]!.removed) hunk.oLength += parts[index]!.count;
      else hunk.length += parts[index]!.count;
    }
    baseLine += hunk.oLength;
    otherLine += hunk.length;
    hunks.push(hunk);
  }
  return hunks;
}

/**
 * The lines of one side a conflict region covers: from its hunks' extent, shifted by the base lines of the region its
 * hunks don't cover (unchanged on that side). A side without hunks in the region is the base's stretch itself.
 */
function sideSpan(region: Hunk[], side: Hunk['side'], regionStart: number, regionEnd: number, sideLength: number, baseLength: number): [number, number] {
  const bounds = [sideLength, -1, baseLength, -1];
  for (const hunk of region) {
    if (hunk.side !== side) continue;
    bounds[0] = Math.min(hunk.start, bounds[0]!);
    bounds[1] = Math.max(hunk.start + hunk.length, bounds[1]!);
    bounds[2] = Math.min(hunk.oStart, bounds[2]!);
    bounds[3] = Math.max(hunk.oStart + hunk.oLength, bounds[3]!);
  }
  return [bounds[0]! + (regionStart - bounds[2]!), bounds[1]! + (regionEnd - bounds[3]!)];
}

function sameLines(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index]);
}
