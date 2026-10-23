import { CmError } from './CmError';

/**
 * `cm cat` of a revision whose content a purge (`cm purge execute`) removed from the server: `Can't retrieve the
 * content of the file '<file>' because the revision (id:13) was purged and its content is no longer available.` It
 * names the file it was to write, never the spec, so `purgedTargetOf` tells which read of a batch it was.
 */
const PURGED_LINE = /^Can't retrieve the content of the file '(.*)' because the revision \(id:\d+\) was purged\b/i;

export function isPurgedRevisionError(error: unknown): boolean {
  return error instanceof CmError && error.message.split(/\r?\n/).some((line) => PURGED_LINE.test(line.trim()));
}

/** The file a purged revision was to be written to, as `cm cat` was given it; null for any other line. */
export function purgedTargetOf(line: string): string | null {
  return PURGED_LINE.exec(line.trim())?.[1] ?? null;
}
