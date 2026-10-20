import { join } from 'node:path';
import { baseVersionSpec, type FileConflictResolution, type MergePlan } from '@shared/domain/merge';

/** One file conflict's decision, as `cm merge --to --fileconflictsresolutionsfile` reads it. */
type FileConflictResolutionEntry = { path: string; keep: 'source' | 'destination' } | { path: string; resultFile: string };

/**
 * A file to write before `cm` runs, whose bytes `cm` takes as the file's content, leaving the file alone: a merged
 * text, or a revision for `cm cat` to save there (a base the page holds no text of), with the conflict's `path`.
 */
export type ResultFile = { file: string; text: string } | { file: string; revision: { spec: string; repository: string; path: string } };

export interface FileConflictResolutionsFile {
  /** The JSON `cm` reads: `{ "resolutions": [{ "path", "keep" | "resultFile" }] }`. */
  json: string;
  resultFiles: ResultFile[];
}

/**
 * Each file conflict's decision for a merge into a server branch, which has no workspace to write them in: a side
 * to keep (`keep`), or the file's content in a file of `directory` (`resultFile`): a merged text, or the base, which
 * `cm` can't keep by name. Paths are the plan's, as `cm merge` printed them. A source kept whose text the page read is
 * still kept by `cm`, which uploads nothing for it.
 */
export function fileConflictResolutionsFile(plan: MergePlan, resolutions: Record<string, FileConflictResolution>, directory: string): FileConflictResolutionsFile {
  const resultFiles: ResultFile[] = [];
  const entries = plan.fileConflicts.map((conflict): FileConflictResolutionEntry => {
    const { path } = conflict;
    const resolution = resolutions[path]!;
    if (resolution.choice === 'source' || resolution.choice === 'destination') return { path, keep: resolution.choice };

    const file = join(directory, `result-${resultFiles.length + 1}`);
    if (resolution.text !== undefined) resultFiles.push({ file, text: resolution.text });
    else resultFiles.push({ file, revision: { spec: baseVersionSpec(conflict), repository: conflict.repository, path } });
    return { path, resultFile: file };
  });
  return { json: JSON.stringify({ resolutions: entries }, null, 2), resultFiles };
}
