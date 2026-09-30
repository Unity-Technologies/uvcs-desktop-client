import { useCallback, useRef, useState } from 'react';
import type { Branch } from '@shared/domain/branch';
import { singleSelection, type SelectionState } from '../../lib/selection';

/**
 * Which branches the tree shows collapsed, and toggling one. Collapsing the branch a selected child hangs from selects
 * it instead. `toggle` stays the same function across selections, so the columns (and their sort) built with it don't
 * change with every one.
 */
export function useCollapsedBranches(
  matching: readonly Branch[],
  selected: Branch | undefined,
  select: (selection: SelectionState) => void,
  keyOf: (branch: Branch) => string,
): { collapsed: ReadonlySet<string>; toggle: (name: string) => void } {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const latest = useRef({ matching, selected, select, keyOf });
  latest.current = { matching, selected, select, keyOf };

  const toggle = useCallback((name: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    const { matching: branches, selected: shown, select: selectRow, keyOf: key } = latest.current;
    const collapsing = branches.find((branch) => branch.name === name);
    if (collapsing && shown?.name.startsWith(`${name}/`)) selectRow(singleSelection(key(collapsing)));
  }, []);

  return { collapsed, toggle };
}
