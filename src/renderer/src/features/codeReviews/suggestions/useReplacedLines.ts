import { useQuery } from '@tanstack/react-query';
import type { ContentSource } from '@shared/domain/content';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import { contentQuery } from '../../diff/viewer/contentQueries';
import { replacedLinesIn, type LineRange, type Read, type ReplacedLines, type SuggestedChange } from './suggestedChange';

const NOTHING: ContentSource = { kind: 'empty' };

/**
 * The lines a suggestion replaces, from the revision it was written on: one immutable read of that revision
 * (`contentQuery`, kept as every revision is), under the key the review's diff reads it by, so in the code it's the
 * diff's own read, and in the conversation one read per revision, shared by every suggestion on it. Read only by a
 * suggestion shown (`SuggestedChangeBlock`; a settled thread starts folded), never for a comment that holds none, and
 * by a new comment on a line, whose Suggest change fills the fence with it (`NewLineCommentCard`): the diff's read.
 */
export function useReplacedLines(change: Pick<SuggestedChange, 'path' | 'revisionId'> & LineRange): ReplacedLines {
  const text = useCommentedText(change);
  return replacedLinesIn(text === 'reading' ? undefined : text === 'failed' ? null : text, change);
}

/**
 * The text of the revision a suggestion was written on (`useReplacedLines`' read): null for one with no text (binary,
 * too large), which has no line to show.
 */
export function useCommentedText(change: Pick<SuggestedChange, 'path' | 'revisionId'>): Read<string | null> {
  const place = usePlace();
  const repository = usePlaceRepository();
  const source: ContentSource = repository ? { kind: 'revision', revision: { revisionId: change.revisionId, repository }, fileName: change.path } : NOTHING;
  const read = useQuery({ ...contentQuery(place, source), enabled: repository !== undefined });
  if (read.isError) return 'failed';
  if (!read.data) return 'reading';
  return read.data.text ?? null;
}
