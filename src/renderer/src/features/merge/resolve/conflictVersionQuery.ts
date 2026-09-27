import type { ContentSource } from '@shared/domain/content';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../../app/queryClient';
import { isImmutableContent } from '../../diff/viewer/immutableContent';

/**
 * One version of a conflicting file, read once. A revision pinned to a changeset or shelve is skipped by refreshes too:
 * completing a merge from a shelve that is then deleted would read it again from a shelve that no longer exists.
 */
export function conflictVersionQuery(workspacePath: string, source: ContentSource) {
  return {
    queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
    queryFn: () => api.content.read(workspacePath, source),
    staleTime: Infinity,
    ...(isImmutableContent(source) && { meta: IMMUTABLE_QUERY }),
  };
}
