import type { Branch } from '@shared/domain/branch';
import { naturalCompare } from '../../lib/naturalCompare';

export interface BranchTreeRow {
  branch: Branch;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
}

/** Branches in the order the tree lists siblings, as people read names; sort once, then filter keeps the order. */
export function sortBranchesByName(branches: readonly Branch[]): Branch[] {
  return [...branches].sort((a, b) => naturalCompare(a.name, b.name));
}

/**
 * Orders branches as a tree under their parents (`/main` → `/main/task` → `/main/task/sub`), siblings in the order
 * given: `branchesByName` comes from `sortBranchesByName` (a filter of it too), so typing a filter never sorts again.
 * Branches whose parent is not in the list become roots, so filtering never hides a match.
 */
export function buildBranchTree(branchesByName: readonly Branch[], collapsed: ReadonlySet<string>): BranchTreeRow[] {
  const names = new Set(branchesByName.map((branch) => branch.name));
  const childrenByParent = new Map<string, Branch[]>();
  const roots: Branch[] = [];

  for (const branch of branchesByName) {
    if (branch.parent && names.has(branch.parent)) {
      const siblings = childrenByParent.get(branch.parent);
      if (siblings) siblings.push(branch);
      else childrenByParent.set(branch.parent, [branch]);
    } else {
      roots.push(branch);
    }
  }

  const rows: BranchTreeRow[] = [];
  const visit = (branch: Branch, depth: number): void => {
    const children = childrenByParent.get(branch.name) ?? [];
    const isCollapsed = collapsed.has(branch.name);
    rows.push({ branch, depth, hasChildren: children.length > 0, collapsed: isCollapsed });
    if (!isCollapsed) for (const child of children) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  return rows;
}
