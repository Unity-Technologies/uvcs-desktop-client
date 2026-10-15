import type { Branch } from '@shared/domain/branch';

/** The most branches the branch field suggests: a repository holds tens of thousands, and a few are all one reads. */
export const MAX_BRANCH_SUGGESTIONS = 30;

/** How well a branch's name answers what was typed (lower case): lower is better, null when it doesn't. */
function matchRank(name: string, typed: string): number | null {
  const lower = name.toLowerCase();
  if (lower === typed) return 0;
  if (lower.slice(lower.lastIndexOf('/') + 1).startsWith(typed)) return 1;
  if (lower.startsWith(typed)) return 2;
  return lower.includes(typed) ? 3 : null;
}

/**
 * The branches the new code review's branch field suggests for what was typed: those whose full name holds it,
 * anywhere and in any case (as the field's suggestions list shows them), the best first: the name itself, then names
 * whose own name starts with it, then paths that do, then the rest, each by newest; with nothing typed, the newest.
 */
export function branchSuggestions(branches: readonly Branch[], typed: string, limit = MAX_BRANCH_SUGGESTIONS): Branch[] {
  const text = typed.trim().toLowerCase();
  const newestFirst = (a: Branch, b: Branch): number => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  if (!text) return [...branches].sort(newestFirst).slice(0, limit);
  const ranked = branches.flatMap((branch) => {
    const rank = matchRank(branch.name, text);
    return rank === null ? [] : [{ branch, rank }];
  });
  ranked.sort((a, b) => a.rank - b.rank || newestFirst(a.branch, b.branch));
  return ranked.slice(0, limit).map(({ branch }) => branch);
}
