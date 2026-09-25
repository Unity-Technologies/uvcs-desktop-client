import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';

export function useAttributeTypes() {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'attributeTypes'),
    queryFn: () => api.attributes.listTypes(workspacePath),
  });
}

/** Attribute values of a branch, changeset or label spec, e.g. `br:/main/task`. */
export function useAttributeValues(objectSpec: string) {
  const workspacePath = useWorkspacePath();
  return useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'attributeValues', objectSpec),
    queryFn: () => api.attributes.valuesOf(workspacePath, objectSpec),
  });
}
