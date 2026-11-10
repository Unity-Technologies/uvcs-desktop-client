import { concurrencyLimit } from '@shared/concurrencyLimit';

/** Runs a read about one listed workspace when its turn comes. */
export type WorkspaceReadTurns = <T>(read: () => Promise<T>) => Promise<T>;

/**
 * One workspace read at a time, across every call that shares these turns (two windows, a list read again while the
 * last read runs, the heads and the kinds of the same list): each is a pooled `cm shell` command of a few ms, and the
 * pool keeps two sessions per directory, so one stays free for every other read. Before the pool is warm, a query runs
 * as a process of its own: one at a time also keeps the home screen from starting a process per workspace.
 */
export function workspaceReadTurns(): WorkspaceReadTurns {
  return concurrencyLimit(1);
}
