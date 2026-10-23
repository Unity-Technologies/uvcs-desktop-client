import type { ContentSource, FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../../app/queryClient';
import { isImmutableContent } from '../../diff/viewer/immutableContent';

/** Why a file one of whose versions was purged can't be merged. */
export const PURGED_VERSION_MESSAGE = "A version of this file was purged from the server, so it can't be merged.";

/**
 * One version of a conflicting file, read once. A revision pinned to a changeset or shelve is skipped by refreshes too:
 * completing a merge from a shelve that is then deleted would read it again from a shelve that no longer exists.
 */
export function conflictVersionQuery(workspacePath: string, source: ContentSource) {
  return {
    queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
    queryFn: () => api.content.read(workspacePath, source).then(mergeableVersion),
    staleTime: Infinity,
    ...(isImmutableContent(source) && { meta: IMMUTABLE_QUERY }),
  };
}

/** A purged version has no text to merge: read as an empty one, the merge would take the file as emptied. */
function mergeableVersion(content: FileContent): FileContent {
  if (content.purged) throw new Error(PURGED_VERSION_MESSAGE);
  return content;
}
