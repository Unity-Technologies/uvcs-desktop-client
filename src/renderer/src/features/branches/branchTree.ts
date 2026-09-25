import type { Branch } from '@shared/domain/branch';

export interface BranchTreeRow {
  branch: Branch;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
}

/**
 * Orders branches as a tree under their parents (`/main` → `/main/task` → `/main/task/sub`).
 * Branches whose parent is not in the list become roots, so filtering never hides a match.
 */
export function buildBranchTree(branches: readonly Branch[], collapsed: ReadonlySet<string>): BranchTreeRow[] {
  const names = new Set(branches.map((branch) => branch.name));
  const childrenByParent = new Map<string, Branch[]>();
  const roots: Branch[] = [];

  for (const branch of branches) {
    if (branch.parent && names.has(branch.parent)) {
      childrenByParent.set(branch.parent, [...(childrenByParent.get(branch.parent) ?? []), branch]);
    } else {
      roots.push(branch);
    }
  }

  const rows: BranchTreeRow[] = [];
  const visit = (branch: Branch, depth: number): void => {
    const children = childrenByParent.get(branch.name) ?? [];
    const isCollapsed = collapsed.has(branch.name);
    rows.push({ branch, depth, hasChildren: children.length > 0, collapsed: isCollapsed });
    if (!isCollapsed) sortByName(children).forEach((child) => visit(child, depth + 1));
  };
  sortByName(roots).forEach((root) => visit(root, 0));
  return rows;
}

function sortByName(branches: Branch[]): Branch[] {
  return [...branches].sort((a, b) => a.name.localeCompare(b.name));
}
