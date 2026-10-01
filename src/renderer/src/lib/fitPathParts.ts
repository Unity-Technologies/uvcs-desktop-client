import type { PathPart } from './pathChangeSegments';
import { ELLIPSIS, trimFolderToFit, trimMiddleToFit } from './trimToFit';

type Measure = (text: string) => number;

/** A step of shortening a line: which parts give way, and how narrow each may get in it. */
interface Stage {
  shrinks: (part: PathPart) => boolean;
  floor: (width: number, maxWidth: number) => number;
}

const isFolder = (part: PathPart): boolean => /[/\\]$/.test(part.text);

/** The part of a line an unchanged name keeps before what the move changed gives way: enough to tell the file. */
const NAME_SHARE = 1 / 3;

/**
 * The parts give way in this order, each stage only as much as the line still needs: unchanged folders (whole
 * folders from their middle, `src/…/merge/`), unchanged names down to a third of the line, then what the move changed
 * (whole folders from the middle of changed folders, `tools/…/runtime-adapters/`), and last the names again.
 */
const STAGES: Stage[] = [
  { shrinks: (part) => !part.changed && isFolder(part), floor: () => 0 },
  { shrinks: (part) => !part.changed && !isFolder(part), floor: (width, maxWidth) => Math.min(width, maxWidth * NAME_SHARE) },
  { shrinks: (part) => part.changed, floor: () => 0 },
  { shrinks: (part) => !part.changed && !isFolder(part), floor: () => 0 },
];

/**
 * A line of a move (`pathChangeSegments`) shortened to fit in `maxWidth` on one line (`STAGES`), so it never wraps
 * and what the move changed stays in view while it can. Parts cut to nothing are left out.
 */
export function fitPathParts(parts: readonly PathPart[], maxWidth: number, measure: Measure): PathPart[] {
  let shown = [...parts];
  for (const stage of STAGES) {
    const excess = totalWidth(shown, measure) - maxWidth;
    if (excess <= 0) break;
    shown = shrink(shown, stage, excess, maxWidth, measure);
  }
  return shown.filter((part) => part.text !== '');
}

/** The parts with those the stage shrinks narrower by `excess` between them, each by its share of what it can give. */
function shrink(parts: PathPart[], { shrinks, floor }: Stage, excess: number, maxWidth: number, measure: Measure): PathPart[] {
  const giving = parts.map((part) => (shrinks(part) ? Math.max(0, measure(part.text) - floor(measure(part.text), maxWidth)) : 0));
  const canGive = giving.reduce((sum, width) => sum + width, 0);
  if (canGive <= 0) return parts;
  return parts.map((part, index) => {
    if (giving[index] === 0) return part;
    const target = measure(part.text) - (giving[index]! * Math.min(excess, canGive)) / canGive;
    return { ...part, text: cutToFit(part, target, measure) };
  });
}

/**
 * Folders lose whole folders from their middle; a changed folder too short for that (one folder, or nothing but `…/`
 * left) and anything else is cut in its middle.
 */
function cutToFit(part: PathPart, width: number, measure: Measure): string {
  if (!isFolder(part)) return trimMiddleToFit(part.text, width, measure);
  const byFolders = trimFolderToFit(part.text, width, measure);
  return part.changed && (byFolders === '' || byFolders === `${ELLIPSIS}/`) ? trimMiddleToFit(part.text, width, measure) : byFolders;
}

function totalWidth(parts: readonly PathPart[], measure: Measure): number {
  return parts.reduce((sum, part) => sum + measure(part.text), 0);
}
