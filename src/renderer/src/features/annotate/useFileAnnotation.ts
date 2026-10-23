import { useQuery } from '@tanstack/react-query';
import { isPinnedSpec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';

/**
 * Whether the annotation of `spec` never changes: a revision pinned to a changeset is annotated once, while the
 * workspace's own version (no spec) follows local edits.
 */
export function isImmutableAnnotation(spec: string | undefined): boolean {
  return spec !== undefined && isPinnedSpec(spec);
}

/**
 * Who last changed each line of `path`: as of the revision `spec` names, or as the workspace has it (a repository
 * explored without one always names a revision).
 */
export function useFileAnnotation(path: string, spec: string | undefined) {
  const place = usePlace();
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'annotate', path, spec),
    queryFn: () => api.annotate.file(place, path, spec),
    ...(isImmutableAnnotation(spec) ? { staleTime: Infinity, meta: IMMUTABLE_QUERY } : {}),
  });
}
