import { diffLines } from 'diff';
import { lineDiffOptions, type ComparisonMethod } from './comparisonMethod';

export interface LineChangeStats {
  added: number;
  removed: number;
}

/** How many lines the modified text adds and removes compared with the original, as the diff shows them under `method`. */
export function lineChangeStats(original: string, modified: string, method: ComparisonMethod = 'recognizeAll'): LineChangeStats {
  let added = 0;
  let removed = 0;
  for (const change of diffLines(original, modified, lineDiffOptions(method))) {
    if (change.added) added += change.count;
    else if (change.removed) removed += change.count;
  }
  return { added, removed };
}

export function hasLineChanges({ added, removed }: LineChangeStats): boolean {
  return added > 0 || removed > 0;
}
