import { CmError } from './CmError';

/**
 * `cm cat` of a revision whose content a purge (`cm purge execute`) removed from the server: `Can't retrieve the
 * content of the file '<file>' because the revision (id:13) was purged and its content is no longer available.` It
 * names the file it was to write, as it was given (`--file=<file>`, or `<spec>;<file>` in a batch), never the spec.
 */
const PURGED_LINE = /^Can't retrieve the content of the file '(.*)' because the revision \(id:\d+\) was purged\b/i;

/**
 * `cm` failing because the revision it was to write to `target` was purged. Only a line naming `target` tells it: a
 * failure passed on whole for a batch (`RevisionCat`'s halves that both failed) may name another read's file.
 */
export function isPurgedRevisionError(error: unknown, target: string): boolean {
  return error instanceof CmError && error.message.split(/\r?\n/).some((line) => purgedTargetOf(line) === target);
}

/** The file a purged revision was to be written to, as `cm cat` was given it; null for any other line. */
export function purgedTargetOf(line: string): string | null {
  return PURGED_LINE.exec(line.trim())?.[1] ?? null;
}
