import type { CommentedRepresentation, RepresentationComments } from '../../diff/viewer/representationComments';
import { holdsThread, type FileComments } from './fileComments';
import type { ThreadFocus } from './reviewComments';
import type { CommentsPlace } from './commentsToggle';

interface FileCommentsInput {
  /** The threads its code shows (at lines, outdated, still placed); none for a file whose code shows none. */
  fileComments: FileComments | null;
  /** The threads on its image. */
  imageThreadIds: ReadonlySet<number>;
  focus: ThreadFocus | null;
}

interface FileCommentsSummary {
  /** For a file shown either as code or as an image (`RepresentationCommentsContext`). */
  representation: RepresentationComments;
  /** Where the header's button hides comments from; none for a file with no comments. */
  hidden: CommentsPlace | null;
}

/**
 * What a review's comments on one file decide beyond where each goes: how many its code and its image hold, and so
 * where the header's button hides them from; and, for a file shown either way (an SVG), the view a thread gone to from
 * elsewhere is on (one picked in place, `ThreadFocus.inPlace`, is on screen already and asks for nothing).
 */
export function fileCommentsSummaryOf({ fileComments, imageThreadIds, focus }: FileCommentsInput): FileCommentsSummary {
  const onText = fileComments ? fileComments.lines.reduce((count, line) => count + line.threads.length, 0) + fileComments.outdated.length : 0;
  const onImage = imageThreadIds.size;
  const focusedOn: CommentedRepresentation | null = focus === null ? null : holdsThread(fileComments, focus.threadId) ? 'text' : imageThreadIds.has(focus.threadId) ? 'image' : null;
  const asked = focus !== null && !focus.inPlace && focusedOn !== null ? { representation: focusedOn, seq: focus.seq } : null;
  const hidden = onText > 0 && onImage > 0 ? 'both' : onText > 0 ? 'code' : onImage > 0 ? 'image' : null;
  return { representation: { onText, onImage, asked }, hidden };
}
