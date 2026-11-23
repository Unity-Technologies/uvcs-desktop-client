import type { CommentedRepresentation, RepresentationComments } from '../../diff/viewer/representationComments';
import { holdsThread, type FileComments } from './fileComments';
import type { ThreadFocus } from './reviewComments';

interface FileCommentsInput {
  /** The threads its code shows (at lines, outdated, still placed); none for a file whose code shows none. */
  fileComments: FileComments | null;
  /** The threads on its image. */
  imageThreadIds: ReadonlySet<number>;
  /** The threads on its 3D model. */
  modelThreadIds: ReadonlySet<number>;
  focus: ThreadFocus | null;
  /** The review's id: with the focus's `seq`, it names each time a thread is gone to in the window. */
  reviewId: number;
}

interface FileCommentsSummary {
  /** For a file shown either as code or as what it draws, an image or a model (`RepresentationCommentsContext`). */
  representation: RepresentationComments;
  /** The file has comments, in its code or on what it draws: its header shows the button that hides them. */
  hasComments: boolean;
}

/**
 * What a review's comments on one file decide beyond where each goes: how many its code and what it draws (its image or
 * its model) hold, and so whether the header shows the button that hides them; and, for a file shown either way (an SVG, an
 * OBJ), the view a thread gone to from
 * elsewhere is on (one picked in place, `ThreadFocus.inPlace`, is on screen already and asks for nothing).
 */
export function fileCommentsSummaryOf({ fileComments, imageThreadIds, modelThreadIds, focus, reviewId }: FileCommentsInput): FileCommentsSummary {
  const onText = fileComments ? fileComments.lines.reduce((count, line) => count + line.threads.length, 0) + fileComments.outdated.length : 0;
  const onRendered = imageThreadIds.size + modelThreadIds.size;
  const onRenderedThread = (threadId: number) => imageThreadIds.has(threadId) || modelThreadIds.has(threadId);
  const focusedOn: CommentedRepresentation | null = focus === null ? null : holdsThread(fileComments, focus.threadId) ? 'text' : onRenderedThread(focus.threadId) ? 'rendered' : null;
  const asked = focus !== null && !focus.inPlace && focusedOn !== null ? { representation: focusedOn, key: `${reviewId}:${focus.seq}` } : null;
  return { representation: { onText, onRendered, asked }, hasComments: onText + onRendered > 0 };
}

