import type { LineThread } from './fileThreads';

/**
 * What a thread written on an earlier version of the file says of it in the code: placed at its line, unchanged since,
 * it is "Earlier version"; its line changed or gone, "Outdated", as GitHub says. The tooltip names the changeset it was
 * written in, when it was written in one changeset's diff.
 */
export function earlierTagOf(thread: LineThread, outdated: boolean): { label: string; tip: string } {
  const where = thread.root.changesetId === undefined ? 'an earlier version of this file' : `the file as changeset ${thread.root.changesetId} left it`;
  return outdated
    ? { label: 'Outdated', tip: `Written on ${where}: its line changed since` }
    : { label: 'Earlier version', tip: `Written on ${where}: this line hasn't changed since` };
}
