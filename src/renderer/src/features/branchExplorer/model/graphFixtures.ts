import type { BranchExplorerData, GraphBranch, GraphChangeset, MergeLink } from '@shared/domain/branchExplorer';

/** Test helpers to describe small histories tersely. */
export function branch(name: string, parent = '', headChangeset = 0): GraphBranch {
  return { id: 0, name, parent, headChangeset, owner: 'jane@example.com', date: '2026-09-01T00:00:00Z', comment: '', isHidden: false };
}

export function changeset(id: number, branchName: string, parent: number, comment = ''): GraphChangeset {
  return { id, branch: branchName, parent, comment, owner: 'jane@example.com', date: `2026-09-${String(id + 1).padStart(2, '0')}T00:00:00Z` };
}

export function merge(sourceChangeset: number, destinationChangeset: number): MergeLink {
  return { type: 'merge', sourceChangeset, destinationChangeset };
}

/**
 * /main:    0 ─ 1 ─── 3 ─────── 6   (6 merges 5, labeled v1)
 * /main/a:      └ 2 ──── 4 ─ 5
 * /main/b:                    └ 7   (starts from 6)
 */
export function sampleHistory(): BranchExplorerData {
  return {
    branches: [branch('/main', '', 6), branch('/main/a', '/main', 5), branch('/main/b', '/main', 7)],
    changesets: [
      changeset(0, '/main', -1),
      changeset(1, '/main', 0),
      changeset(2, '/main/a', 1),
      changeset(3, '/main', 1),
      changeset(4, '/main/a', 2),
      changeset(5, '/main/a', 4, 'Finish feature'),
      changeset(6, '/main', 3, 'Merge a'),
      changeset(7, '/main/b', 6),
    ],
    mergeLinks: [merge(5, 6)],
    labels: [{ name: 'v1', changeset: 6, owner: 'jane@example.com', date: '2026-09-07T00:00:00Z', comment: '' }],
  };
}

/**
 * A big, repository-like history for scale tests: task branches forking from /main (some from other tasks), a few
 * changesets each while others progress in parallel, then merged back into their parent; labels every 200 changesets.
 * Deterministic for a given size.
 */
export function largeHistory(changesetCount: number, branchCount: number): BranchExplorerData {
  let seed = 7;
  const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const start = Date.parse('2020-01-01T00:00:00Z');
  const branches: GraphBranch[] = [branch('/main')];
  const changesets: GraphChangeset[] = [];
  const mergeLinks: MergeLink[] = [];
  const heads = new Map<string, number>();
  const active: { branch: GraphBranch; left: number }[] = [];
  const add = (branchName: string, parent: number): number => {
    const id = changesets.length;
    const date = new Date(start + id * 20 * 60_000).toISOString();
    changesets.push({ id, branch: branchName, parent, date, owner: `dev${id % 40}@example.com`, comment: `Change ${id} to module ${id % 97}\nDetails` });
    heads.set(branchName, id);
    return id;
  };
  add('/main', -1);
  const perBranch = changesetCount / branchCount;
  while (changesets.length < changesetCount) {
    if (branches.length < branchCount && (active.length < 8 || (active.length < 60 && random() * perBranch < 1.3))) {
      const parent = random() < 0.8 || active.length === 0 ? '/main' : active[Math.floor(random() * active.length)]!.branch.name;
      const created = { ...branch(`${parent}/task${branches.length}`, parent), id: branches.length, comment: branches.length % 3 === 0 ? `Task ${branches.length}` : '' };
      branches.push(created);
      add(created.name, heads.get(parent)!);
      active.push({ branch: created, left: 1 + Math.floor(random() * 4) });
      continue;
    }
    if (active.length === 0 || random() < 0.15) {
      add('/main', heads.get('/main')!);
      continue;
    }
    const index = Math.floor(random() * active.length);
    const task = active[index]!;
    const head = add(task.branch.name, heads.get(task.branch.name)!);
    if (--task.left > 0) continue;
    active.splice(index, 1);
    // A task whose parent task is done goes to /main instead.
    const target = task.branch.parent === '/main' || active.some((other) => other.branch.name === task.branch.parent) ? task.branch.parent : '/main';
    mergeLinks.push(merge(head, add(target, heads.get(target)!)));
  }
  for (const each of branches) each.headChangeset = heads.get(each.name) ?? 0;
  const labels = changesets
    .filter((each) => each.branch === '/main' && each.id % 200 === 0)
    .map((each) => ({ name: `v${each.id}`, changeset: each.id, owner: each.owner, date: each.date, comment: '' }));
  return { branches, changesets, mergeLinks, labels };
}
