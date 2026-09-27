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
  let conflictCount = 0;

  const text = regions
    .map((region) => {
      if ('ok' in region) return region.ok.join('');
      conflictCount++;
      return [
        `${MARKER_START}${labels.destination}${lineBreak}`,
        ended(region.conflict.a.join('')),
        `${MARKER_SEPARATOR}${lineBreak}`,
        ended(region.conflict.b.join('')),
        `${MARKER_END}${labels.source}${lineBreak}`,
      ].join('');
    })
    .join('');

  return { text, conflictCount };
}

/** Whether text (e.g. edited by hand) still contains unresolved conflict markers. */
export function hasConflictMarkers(text: string): boolean {
  return splitLines(text).some((line) => line.startsWith(MARKER_START) || line.startsWith(MARKER_END));
}

/** Which side of a conflict region to keep: the destination (current, first), the source (incoming) or both. */
export type ConflictRegionChoice = 'current' | 'incoming' | 'both';

/** Replaces the conflict region number `conflictIndex` (0-based) with the chosen side(s). */
export function resolveConflictRegion(text: string, conflictIndex: number, choice: ConflictRegionChoice): string {
  const lines = splitLines(text);
  const output: string[] = [];
  let index = -1;

  for (let position = 0; position < lines.length; position++) {
    const line = lines[position]!;
    if (!line.startsWith(MARKER_START) || ++index !== conflictIndex) {
      output.push(line);
      continue;
    }

    const current: string[] = [];
    const incoming: string[] = [];
    let side = current;
    for (position++; position < lines.length && !lines[position]!.startsWith(MARKER_END); position++) {
      if (lines[position]!.trimEnd() === MARKER_SEPARATOR) side = incoming;
      else side.push(lines[position]!);
    }

    if (choice !== 'incoming') output.push(...current);
    if (choice !== 'current') output.push(...incoming);
  }
  return output.join('');
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
