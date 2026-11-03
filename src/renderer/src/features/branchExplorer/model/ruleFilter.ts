import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import type { ExplorerRule, RuleExpansion } from './explorerRules';
import { matchedBy, type RuleMatches } from './ruleMatches';

/**
 * The branches the inclusion and exclusion rules keep, or null when none takes part (everything stays). The enabled
 * inclusions' branches, with the relatives each one asks for, are all that stays when there is any; the exclusions'
 * branches and their relatives go, even when an inclusion matched them.
 */
export function branchesKeptByRules(data: BranchExplorerData, rules: readonly ExplorerRule[], matches: RuleMatches): ReadonlySet<string> | null {
  const family = branchFamily(data);
  let included: Set<string> | null = null;
  const excluded = new Set<string>();
  for (const rule of rules) {
    if (rule.kind !== 'include' && rule.kind !== 'exclude') continue;
    const matched = matchedBy(rule, matches);
    if (!matched) continue;
    const branches = expand(family, matched, rule.expansion);
    if (rule.kind === 'include') included = new Set([...(included ?? []), ...branches]);
    else for (const name of branches) excluded.add(name);
  }
  if (!included && excluded.size === 0) return null;
  const candidates = included ?? data.branches.map((branch) => branch.name);
  return new Set([...candidates].filter((name) => !excluded.has(name)));
}

/** How the loaded branches relate: who starts from whom, and who was merged into whom. */
interface BranchFamily {
  names: ReadonlySet<string>;
  parentOf: ReadonlyMap<string, string>;
  childrenOf: ReadonlyMap<string, string[]>;
  mergedFrom: ReadonlyMap<string, Set<string>>;
  mergedInto: ReadonlyMap<string, Set<string>>;
}

function branchFamily(data: BranchExplorerData): BranchFamily {
  const names = new Set(data.branches.map((branch) => branch.name));
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const branch of data.branches) {
    if (!names.has(branch.parent)) continue;
    parentOf.set(branch.name, branch.parent);
    childrenOf.set(branch.parent, [...(childrenOf.get(branch.parent) ?? []), branch.name]);
  }
  const branchOfChangeset = new Map(data.changesets.map((changeset) => [changeset.id, changeset.branch]));
  const mergedFrom = new Map<string, Set<string>>();
  const mergedInto = new Map<string, Set<string>>();
  const link = (links: Map<string, Set<string>>, from: string, to: string): void => {
    const set = links.get(from);
    if (set) set.add(to);
    else links.set(from, new Set([to]));
  };
  for (const merge of data.mergeLinks) {
    const source = branchOfChangeset.get(merge.sourceChangeset);
    const destination = branchOfChangeset.get(merge.destinationChangeset);
    if (source === undefined || destination === undefined || source === destination) continue;
    link(mergedFrom, destination, source);
    link(mergedInto, source, destination);
  }
  return { names, parentOf, childrenOf, mergedFrom, mergedInto };
}

/** `matched` (the loaded ones) with the relatives `expansion` asks for, found from each matched branch. */
function expand(family: BranchFamily, matched: ReadonlySet<string>, expansion: RuleExpansion): Set<string> {
  const result = new Set([...matched].filter((name) => family.names.has(name)));
  for (const name of [...result]) {
    if (expansion.parent) addIfPresent(result, family.parentOf.get(name));
    if (expansion.mergeSources) for (const source of family.mergedFrom.get(name) ?? []) result.add(source);
    if (expansion.mergeDestinations) for (const destination of family.mergedInto.get(name) ?? []) result.add(destination);
    if (expansion.children) for (const child of descendants(family, name)) result.add(child);
  }
  return result;
}

function descendants(family: BranchFamily, name: string): string[] {
  const found: string[] = [];
  const pending = [...(family.childrenOf.get(name) ?? [])];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    found.push(next);
    pending.push(...(family.childrenOf.get(next) ?? []));
  }
  return found;
}

function addIfPresent(set: Set<string>, name: string | undefined): void {
  if (name !== undefined) set.add(name);
}
