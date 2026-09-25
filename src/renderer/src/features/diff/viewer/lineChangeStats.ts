import { diffLines } from 'diff';

export interface LineChangeStats {
  added: number;
  removed: number;
}

/** How many lines the modified text adds and removes compared with the original, as the diff shows them. */
export function lineChangeStats(original: string, modified: string): LineChangeStats {
  let added = 0;
  let removed = 0;
  for (const change of diffLines(original, modified)) {
    if (change.added) added += change.count;
    else if (change.removed) removed += change.count;
  }
  return { added, removed };
}
