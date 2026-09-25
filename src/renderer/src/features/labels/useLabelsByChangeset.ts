import { useMemo } from 'react';
import type { Label } from '@shared/domain/label';
import { useLabels } from './useLabels';

/** Every label in the repository, grouped by the changeset it is on. */
export function useLabelsByChangeset(): ReadonlyMap<number, readonly Label[]> {
  const { data: labels } = useLabels();
  return useMemo(() => {
    const byChangeset = new Map<number, Label[]>();
    for (const label of labels ?? []) {
      const group = byChangeset.get(label.changeset);
      if (group) group.push(label);
      else byChangeset.set(label.changeset, [label]);
    }
    return byChangeset;
  }, [labels]);
}
