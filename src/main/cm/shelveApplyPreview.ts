import type { ShelveApplyPreview } from '@shared/domain/shelve';

const CONFLICT_LINE = /^The (?:file|directory|item) (\S.*?) needs to be merged from /;
const CHANGE_LINE = /^The (?:file|directory|item) (\S.*?)#sh:\d+ /;

/**
 * Parses `cm shelveset apply --preview`. It has no machine-readable format, so we only rely on
 * the path at the start of each line and on whether the line announces a merge.
 */
export function parseShelveApplyPreview(output: string): ShelveApplyPreview {
  const changedPaths: string[] = [];
  const conflictedPaths: string[] = [];

  for (const line of output.split('\n').map((text) => text.trim())) {
    const conflict = CONFLICT_LINE.exec(line);
    if (conflict) {
      conflictedPaths.push(conflict[1]!);
      changedPaths.push(conflict[1]!);
      continue;
    }
    const change = CHANGE_LINE.exec(line);
    if (change) changedPaths.push(change[1]!);
  }

  return { changedPaths, conflictedPaths };
}
