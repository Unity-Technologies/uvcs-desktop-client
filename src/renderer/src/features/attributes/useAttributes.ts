import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { useSettled } from '../../lib/useSettled';
import { defaultValuesIn, suggestedValues } from './attributeValues';

export function useAttributeTypes() {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'attributeTypes'),
    queryFn: () => api.attributes.listTypes(workspacePath),
    ...SLOW_CHANGING_QUERY,
  });
}

/**
 * Attribute values of a branch, changeset or label spec, e.g. `br:/main/task`; asked for once the selection settles.
 * They change by edits, which refresh them, so coming back to the object doesn't ask again for a few minutes.
 */
export function useAttributeValues(objectSpec: string) {
  const workspacePath = useWorkspacePath();
  const settled = useSettled();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'attributeValues', objectSpec),
    queryFn: () => api.attributes.valuesOf(workspacePath, objectSpec),
    enabled: settled,
    ...SLOW_CHANGING_QUERY,
  });
}

/** Values to offer while editing an attribute: its declared defaults, then the ones it takes elsewhere. Fetched only while `enabled`. */
export function useAttributeSuggestions(attribute: string, enabled: boolean): string[] {
  const workspacePath = useWorkspacePath();
  const { data: types } = useAttributeTypes();
  const { data: used } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'attributeUsedValues', attribute),
    queryFn: () => api.attributes.usedValues(workspacePath, attribute),
    enabled,
    staleTime: 60_000,
  });
  const comment = types?.find((type) => type.name === attribute)?.comment ?? '';
  return useMemo(() => suggestedValues(defaultValuesIn(comment), used ?? []), [comment, used]);
}
