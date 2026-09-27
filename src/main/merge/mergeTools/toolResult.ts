import type { MergeToolOutcome } from '@shared/domain/mergeTools';
import type { ToolRun } from './launch';

/** The temp files a tool gets for one file: each version named after it, so the tool shows the name and syntax. */
export function toolFileNames(path: string): { base: string; yours: string; incoming: string; result: string } {
  const name = path.split(/[\\/]/).pop()!.replace(/[^\w .-]/g, '_') || 'file';
  const dot = name.lastIndexOf('.');
  const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  return { base: `${stem}.BASE${extension}`, yours: `${stem}.YOURS${extension}`, incoming: `${stem}.INCOMING${extension}`, result: name };
}

export interface ToolFiles {
  /** What the result file held when the tool opened. */
  start: Buffer;
  /** What it holds now; null if missing. */
  result: Buffer | null;
}

/**
 * Sooner than anyone opens a file, looks at it and closes it: a tool that fails this fast, saying why on stderr, never
 * showed the file (`opendiff` before the Xcode license is accepted, a bad option).
 */
const FAILED_TO_OPEN_SECONDS = 3;

/**
 * What the tool did, told by the result file: only KDiff3, Beyond Compare and the UVCS tool say by their exit code
 * whether the user saved, and a user who stops waiting may well have saved already (VS Code waits for its tab to
 * close), so what it saved comes back as the file's text.
 */
export function judgeToolResult(files: ToolFiles, run: ToolRun): MergeToolOutcome {
  const { start, result } = files;
  if (!result || result.equals(start)) {
    const failedToOpen = run.exitCode !== null && run.exitCode !== 0 && run.errorOutput && run.seconds < FAILED_TO_OPEN_SECONDS;
    return failedToOpen ? { kind: 'failed', message: lastLine(run.errorOutput) } : { kind: 'unchanged', exitCode: run.exitCode, errorOutput: run.errorOutput };
  }
  return { kind: 'resolved', text: result.toString('utf8') };
}

function lastLine(text: string): string {
  return text.split('\n').filter((line) => line.trim()).at(-1)!.trim();
}
