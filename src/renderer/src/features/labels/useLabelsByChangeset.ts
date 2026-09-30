import { useMemo } from 'react';
import type { Label } from '@shared/domain/label';
import { groupBy } from '../../lib/groupBy';
import { useLabels } from './useLabels';

const NO_LABELS: ReadonlyMap<number, readonly Label[]> = new Map();

/**
 * Every label in the repository, grouped by the changeset it is on. None for the changesets of `otherRepository` (a
 * file's under an xlink): the workspace's labels are on its own changesets, whose numbers another repository reuses.
 */
export function useLabelsByChangeset(otherRepository?: string): ReadonlyMap<number, readonly Label[]> {
  const { data: labels } = useLabels();
  const byChangeset = useMemo(() => groupBy(labels ?? [], (label) => label.changeset), [labels]);
  return otherRepository ? NO_LABELS : byChangeset;
}
