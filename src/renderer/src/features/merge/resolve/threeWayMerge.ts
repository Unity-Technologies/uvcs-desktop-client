import { diff3Merge } from 'node-diff3';

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

/** Splits text into lines that keep their line terminators, so joining them gives the text back exactly. */
export function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/**
 * Three-way merge by lines. Changes made on only one side (or identically on both) are applied;
 * overlapping changes are written between conflict markers, destination first, for the user to decide.
 */
export function buildConflictDocument(base: string, source: string, destination: string, labels: ConflictLabels): ConflictDocument {
  const regions = diff3Merge(splitLines(destination), splitLines(base), splitLines(source), { excludeFalseConflicts: true });
  let conflictCount = 0;

  const text = regions
    .map((region) => {
      if (region.ok) return region.ok.join('');
      if (!region.conflict) return '';
      conflictCount++;
      return [
        `${MARKER_START}${labels.destination}\n`,
        ensureTrailingNewline(region.conflict.a.join('')),
        `${MARKER_SEPARATOR}\n`,
        ensureTrailingNewline(region.conflict.b.join('')),
        `${MARKER_END}${labels.source}\n`,
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

/** How many conflict regions are still open in the text. */
export function countConflictRegions(text: string): number {
  return splitLines(text).filter((line) => line.startsWith(MARKER_START)).length;
}

function ensureTrailingNewline(text: string): string {
  return text === '' || text.endsWith('\n') ? text : `${text}\n`;
}
