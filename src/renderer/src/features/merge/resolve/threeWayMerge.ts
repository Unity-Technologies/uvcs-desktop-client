import { diff3Merge } from './diff3';
import { dominantLineBreak, endsWithLineBreak, splitLines } from '../../../lib/lineBreaks';

/** Names shown on the conflict markers. The destination is "current", the source is "incoming". */
export interface ConflictLabels {
  source: string;
  destination: string;
}

/** A file merged line by line: overlapping changes are wrapped in Git-style conflict markers. */
export interface ConflictDocument {
  text: string;
  conflictCount: number;
  /** Each conflict as the merge wrote it, in order, with the base it came from: the markers hold only the sides. */
  conflicts: ConflictVersions[];
}

/** One conflict's lines, joined: each side's as written between the markers, and the base's as it was. */
export interface ConflictVersions {
  current: string;
  base: string;
  incoming: string;
}

const MARKER_START = '<<<<<<< ';
const MARKER_SEPARATOR = '=======';
const MARKER_END = '>>>>>>> ';

/**
 * Three-way merge by lines (broken by LF, CRLF or lone CRs, each line keeping its own). Changes made on only one side
 * (or identically on both) are applied; overlapping changes are written between conflict markers, destination first,
 * for the user to decide. The markers end with the destination's most common line break, so a file of lone CRs stays one.
 */
export function buildConflictDocument(base: string, source: string, destination: string, labels: ConflictLabels): ConflictDocument {
  const [destinationLines, baseLines, sourceLines] = [destination, base, source].map(splitLines) as [string[], string[], string[]];
  const lineBreak = dominantLineBreak(destinationLines) ?? dominantLineBreak(sourceLines) ?? dominantLineBreak(baseLines) ?? '\n';
  const regions = diff3Merge(destinationLines, baseLines, sourceLines);
  const ended = (text: string): string => (text === '' || endsWithLineBreak(text) ? text : text + lineBreak);
  const conflicts: ConflictVersions[] = [];

  const text = regions
    .map((region) => {
      if ('ok' in region) return region.ok.join('');
      const { a, o, b } = region.conflict;
      const versions = { current: ended(a.join('')), base: o.join(''), incoming: ended(b.join('')) };
      conflicts.push(versions);
      return [
        `${MARKER_START}${labels.destination}${lineBreak}`,
        versions.current,
        `${MARKER_SEPARATOR}${lineBreak}`,
        versions.incoming,
        `${MARKER_END}${labels.source}${lineBreak}`,
      ].join('');
    })
    .join('');

  return { text, conflictCount: conflicts.length, conflicts };
}

/** Whether text (e.g. edited by hand) still contains unresolved conflict markers. */
export function hasConflictMarkers(text: string): boolean {
  return splitLines(text).some((line) => line.startsWith(MARKER_START) || line.startsWith(MARKER_END));
}

/** Which side of a conflict region to keep: the destination (current, first), the source (incoming) or both. */
export type ConflictRegionChoice = 'current' | 'incoming' | 'both';

/** Replaces the conflict region number `conflictIndex` (0-based) with the chosen side(s). */
export function resolveConflictRegion(text: string, conflictIndex: number, choice: ConflictRegionChoice): string {
  return replaceConflictRegion(text, conflictIndex, ({ current, incoming }) => [...(choice !== 'incoming' ? current : []), ...(choice !== 'current' ? incoming : [])]);
}

/** Replaces the conflict region number `conflictIndex` (0-based) with its base (`conflictBases`), as it was. */
export function keepConflictRegionBase(text: string, conflictIndex: number, base: string): string {
  return replaceConflictRegion(text, conflictIndex, () => [base]);
}

/**
 * The base of each conflict region left in `text`, in order: that of the document's next conflict whose sides it
 * still holds, as regions are only ever taken out whole. None for a region whose sides were edited by hand.
 */
export function conflictBases(text: string, document: ConflictDocument): (string | undefined)[] {
  let next = 0;
  return conflictRegionsOf(splitLines(text)).map(({ current, incoming }) => {
    const [currentText, incomingText] = [current.join(''), incoming.join('')];
    const found = document.conflicts.findIndex((conflict, index) => index >= next && conflict.current === currentText && conflict.incoming === incomingText);
    if (found < 0) return undefined;
    next = found + 1;
    return document.conflicts[found]!.base;
  });
}

/** A conflict region's lines between its markers, and the line its end marker is on (the last, when it has none). */
interface ConflictRegionLines {
  current: string[];
  incoming: string[];
  end: number;
}

function replaceConflictRegion(text: string, conflictIndex: number, replacement: (region: ConflictRegionLines) => string[]): string {
  const lines = splitLines(text);
  const output: string[] = [];
  let index = -1;

  for (let position = 0; position < lines.length; position++) {
    const line = lines[position]!;
    if (!line.startsWith(MARKER_START) || ++index !== conflictIndex) {
      output.push(line);
      continue;
    }
    const region = readConflictRegion(lines, position);
    output.push(...replacement(region));
    position = region.end;
  }
  return output.join('');
}

function conflictRegionsOf(lines: string[]): ConflictRegionLines[] {
  const regions: ConflictRegionLines[] = [];
  for (let position = 0; position < lines.length; position++) {
    if (!lines[position]!.startsWith(MARKER_START)) continue;
    const region = readConflictRegion(lines, position);
    regions.push(region);
    position = region.end;
  }
  return regions;
}

/** The region whose start marker is on line `start`. */
function readConflictRegion(lines: string[], start: number): ConflictRegionLines {
  const current: string[] = [];
  const incoming: string[] = [];
  let side = current;
  let position = start + 1;
  for (; position < lines.length && !lines[position]!.startsWith(MARKER_END); position++) {
    if (lines[position]!.trimEnd() === MARKER_SEPARATOR) side = incoming;
    else side.push(lines[position]!);
  }
  return { current, incoming, end: position };
}

/** Resolves every conflict region the same way. */
export function resolveEveryConflictRegion(text: string, choice: ConflictRegionChoice): string {
  let resolved = text;
  while (countConflictRegions(resolved) > 0) resolved = resolveConflictRegion(resolved, 0, choice);
  return resolved;
}

/** How many conflict regions are still open in the text. */
export function countConflictRegions(text: string): number {
  return splitLines(text).filter((line) => line.startsWith(MARKER_START)).length;
}
