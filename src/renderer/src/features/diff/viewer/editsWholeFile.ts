import type { ComparisonMethod } from './comparisonMethod';
import { hasLineChanges, lineChangeStats } from './lineChangeStats';

/**
 * Whether the in-place editor shows the modified text on its own instead of as a diff. The diff renders only the lines
 * around changes, so with none to show (a checked-out file not changed yet, an empty file, only differences the
 * comparison method ignores) it would open the editor empty.
 */
export function editsWholeFile(original: string, modified: string, method: ComparisonMethod): boolean {
  return !hasLineChanges(lineChangeStats(original, modified, method));
}
