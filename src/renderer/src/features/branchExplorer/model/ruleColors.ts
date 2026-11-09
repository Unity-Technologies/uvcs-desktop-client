import type { BranchExplorerData, MergeLinkType } from '@shared/domain/branchExplorer';
import type { ExplorerRule } from './explorerRules';
import { matchedBy, type RuleMatches } from './ruleMatches';

/** The hue each format rule gives what it matches: a later rule over an earlier one. */
export interface RuleColors {
  branches: ReadonlyMap<string, number>;
  changesets: ReadonlyMap<number, number>;
  labels: ReadonlyMap<string, number>;
}

export const NO_RULE_COLORS: RuleColors = { branches: new Map(), changesets: new Map(), labels: new Map() };

/** What the format rules color in `data`; `currentBranch` is the workspace's branch (null in a repository's window). */
export function ruleColors(data: BranchExplorerData, rules: readonly ExplorerRule[], matches: RuleMatches, currentBranch: string | null): RuleColors {
  const branches = new Map<string, number>();
  const changesets = new Map<number, number>();
  const labels = new Map<string, number>();
  for (const rule of rules) {
    if (!rule.enabled || rule.hue === null) continue;
    const hue = rule.hue;
    switch (rule.kind) {
      case 'pendingMerges':
        for (const name of branchesWithPendingMerges(data)) branches.set(name, hue);
        break;
      case 'currentBranch':
        if (currentBranch !== null) branches.set(currentBranch, hue);
        break;
      case 'branchFormat':
        for (const name of matchedBy(rule, matches) ?? []) branches.set(name, hue);
        break;
      case 'changesetFormat':
        for (const id of matchedBy(rule, matches) ?? []) changesets.set(Number(id), hue);
        break;
      case 'labelFormat':
        for (const name of matchedBy(rule, matches) ?? []) labels.set(name, hue);
        break;
      case 'include':
      case 'exclude':
        break;
    }
  }
  return branches.size + changesets.size + labels.size === 0 ? NO_RULE_COLORS : { branches, changesets, labels };
}

/** Links that take a branch's changes whole: cherry picks and subtractions leave the rest of it still to merge. */
const MERGES_OUT: ReadonlySet<MergeLinkType> = new Set(['merge', 'interval']);

/**
 * The child branches holding changes not merged out of them yet: their newest loaded changeset is newer than the
 * newest one merged from them into another branch (or nothing was merged from them at all). Top-level branches have
 * nowhere to be merged, so they never count.
 */
export function branchesWithPendingMerges(data: BranchExplorerData): Set<string> {
  const branchOfChangeset = new Map(data.changesets.map((changeset) => [changeset.id, changeset.branch]));
  const newest = new Map<string, number>();
  for (const changeset of data.changesets) newest.set(changeset.branch, Math.max(newest.get(changeset.branch) ?? -1, changeset.id));
  const newestMergedOut = new Map<string, number>();
  for (const link of data.mergeLinks) {
    if (!MERGES_OUT.has(link.type)) continue;
    const source = branchOfChangeset.get(link.sourceChangeset);
    if (source === undefined || source === branchOfChangeset.get(link.destinationChangeset)) continue;
    newestMergedOut.set(source, Math.max(newestMergedOut.get(source) ?? -1, link.sourceChangeset));
  }
  const pending = new Set<string>();
  for (const branch of data.branches) {
    if (!branch.parent) continue;
    const head = newest.get(branch.name);
    if (head !== undefined && head > (newestMergedOut.get(branch.name) ?? -1)) pending.add(branch.name);
  }
  return pending;
}
