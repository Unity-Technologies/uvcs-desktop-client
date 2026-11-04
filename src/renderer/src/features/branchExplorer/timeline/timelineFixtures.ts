import type { BranchExplorerData, GraphChangeset } from '@shared/domain/branchExplorer';
import { branch } from '../model/graphFixtures';

/** A changeset of a dated history: when, and optionally on which branch and by whom. */
export interface DatedChangeset {
  date: string;
  branch?: string;
  owner?: string;
}

/**
 * Test helper: a history of changesets with the given dates, ids 0, 1, 2… in that order, on /main unless they say
 * otherwise. A changeset's parent is the one before it on its branch, or /main's last for a branch's first.
 */
export function datedHistory(entries: readonly (DatedChangeset | string)[]): BranchExplorerData {
  const heads = new Map<string, number>();
  const changesets: GraphChangeset[] = entries.map((entry, id) => {
    const { date, branch: branchName = '/main', owner = 'jane@example.com' } = typeof entry === 'string' ? { date: entry } : entry;
    const parent = heads.get(branchName) ?? heads.get('/main') ?? -1;
    heads.set(branchName, id);
    return { id, branch: branchName, parent, date, owner, comment: '' };
  });
  const branches = [...heads].map(([name, head]) => branch(name, name === '/main' ? '' : '/main', head));
  return { branches, changesets, mergeLinks: [], labels: [] };
}

/** `count` dates `stepMinutes` apart from `start` (ISO). */
export function datesEvery(start: string, count: number, stepMinutes: number): string[] {
  const from = Date.parse(start);
  return Array.from({ length: count }, (_, index) => new Date(from + index * stepMinutes * 60_000).toISOString());
}
