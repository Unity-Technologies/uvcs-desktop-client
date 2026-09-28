import { useMemo } from 'react';
import type { Label } from '@shared/domain/label';
import { useLabels } from './useLabels';

const NO_LABELS: ReadonlyMap<number, readonly Label[]> = new Map();

/**
 * Every label in the repository, grouped by the changeset it is on. None for the changesets of `otherRepository` (a
 * file's under an xlink): the workspace's labels are on its own changesets, whose numbers another repository reuses.
 */
export function useLabelsByChangeset(otherRepository?: string): ReadonlyMap<number, readonly Label[]> {
  const { data: labels } = useLabels();
  const byChangeset = useMemo(() => {
    const grouped = new Map<number, Label[]>();
    for (const label of labels ?? []) {
      const group = grouped.get(label.changeset);
      if (group) group.push(label);
      else grouped.set(label.changeset, [label]);
    }
    return grouped;
  }, [labels]);
  return otherRepository ? NO_LABELS : byChangeset;
}
