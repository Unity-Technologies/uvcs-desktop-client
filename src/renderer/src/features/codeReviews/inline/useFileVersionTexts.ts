import { useQueries } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import { contentQuery } from '../../diff/viewer/contentQueries';

/**
 * The texts of some revisions of a file, by revision: the versions a review's threads were written on, and the newer
 * side's, to place those threads where their lines are now (`fileCommentsOf`). Each is read once and kept as every
 * revision is (`contentQuery`): the newer side's is the diff's own read, shared. None is read for a file whose threads
 * are all on the versions shown (`revisions` empty), the common case.
 */
export function useFileVersionTexts(place: Place, repository: string, fileName: string, revisions: readonly number[]): (revisionId: number) => string | undefined {
  const results = useQueries({
    queries: revisions.map((revisionId) => contentQuery(place, { kind: 'revision', revision: { revisionId, repository }, fileName })),
  });
  return (revisionId) => {
    const index = revisions.indexOf(revisionId);
    const content = index === -1 ? undefined : results[index]?.data;
    // A version with no text (binary, too large) has no line to find: its threads are outdated rather than waiting.
    return content && (content.text ?? '');
  };
}
