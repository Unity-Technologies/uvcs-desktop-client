import { join } from 'node:path';
import type { FileConflictResolution, MergePlan } from '@shared/domain/merge';

/** One file conflict's decision, as `cm merge --to --fileresolutionsfile` reads it. */
type FileResolutionEntry = { path: string; keep: 'source' | 'destination' } | { path: string; resultFile: string };

/** A merged text to write before `cm` runs; `cm` takes its bytes as the file's content and leaves the file alone. */
export interface ResultFile {
  file: string;
  text: string;
}

export interface FileResolutionsFile {
  /** The JSON `cm` reads: `{ "resolutions": [{ "path", "keep" | "resultFile" }] }`. */
  json: string;
  resultFiles: ResultFile[];
}

/**
 * Each file conflict's decision for a merge into a server branch, which has no workspace to write them in: a side
 * to keep (`keep`), or the merged text in a file of `directory` (`resultFile`). Paths are the plan's, as `cm merge`
 * printed them. A source kept whose text the page read is still kept by `cm`, which uploads nothing for it.
 */
export function fileResolutionsFile(plan: MergePlan, resolutions: Record<string, FileConflictResolution>, directory: string): FileResolutionsFile {
  const resultFiles: ResultFile[] = [];
  const entries = plan.fileConflicts.map(({ path }): FileResolutionEntry => {
    const resolution = resolutions[path]!;
    if (resolution.choice !== 'text') return { path, keep: resolution.choice };

    const file = join(directory, `result-${resultFiles.length + 1}`);
    resultFiles.push({ file, text: resolution.text });
    return { path, resultFile: file };
  });
  return { json: JSON.stringify({ resolutions: entries }, null, 2), resultFiles };
}
