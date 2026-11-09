import type { DiffLineAnnotation } from '@pierre/diffs';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ChangedLine } from '../../diff/viewer/changeBlocks';
import type { ReviewThread } from '../conversation/reviewThreads';
import { earlierRevisions, placeEarlier, threadsOfFile, writtenIn, type EarlierThread, type ReviewDiffView, type ShownFile, type ThreadSide } from './fileThreads';
import { newerLineOf } from './newerLine';
import { lineOfThread, lineThreadsOf, type LineThreads, type ShownThreadRows } from './threadRows';

/** A file's threads as its diff shows them: by line, and those outdated, apart above the code. */
export interface FileComments {
  lines: LineThreads[];
  outdated: EarlierThread[];
  /** The earlier versions to read to place the threads written on them, the newer side's text with them. */
  earlierRevisions: number[];
}

interface FileCommentsInput {
  threads: readonly ReviewThread[];
  review: CodeReviewTarget;
  view: ReviewDiffView;
  file: ShownFile;
  /** An earlier version's text once read, the newer side's (`file.modifiedRevision`) among them. */
  textOf: (revisionId: number) => string | undefined;
}

/**
 * Where a file's threads show (`threadsOfFile`, `placeEarlier`): those on a version the diff shows at their line, those
 * on an earlier one at their line now when it's unchanged since, the rest outdated. Until the earlier versions are read,
 * their threads wait (none shows outdated only to move a moment later).
 */
export function fileCommentsOf({ threads, review, view, file, textOf }: FileCommentsInput): FileComments {
  const { placed, earlier } = threadsOfFile(threads, review, view, file);
  const newer = file.modifiedRevision === -1 ? null : textOf(file.modifiedRevision);
  const placedEarlier = placeEarlier(
    earlier,
    (revisionId) => (newer === undefined ? undefined : textOf(revisionId)),
    (text, line) => (newer === null ? null : newerLineOf(text, newer!, line)),
    (thread) => writtenIn(review, thread).kind === view.kind,
  );
  return { lines: lineThreadsOf([...placed, ...placedEarlier.placed]), outdated: placedEarlier.outdated, earlierRevisions: earlierRevisions(earlier) };
}

/** The row above the code holding a file's outdated threads (`lineNumber: 0`). */
export const OUTDATED_ROW = 'outdated';

/**
 * Pierre's rows for a file's threads: each line's shown, named by its key (`LineThreads.key`), and the outdated ones
 * above the code, on the side the file has (a deleted file has only its older one).
 */
export function annotationRowsOf(shown: Pick<ShownThreadRows, 'rows'>, outdated: readonly EarlierThread[], topSide: ThreadSide): DiffLineAnnotation<string>[] {
  const rows = shown.rows.map((line): DiffLineAnnotation<string> => ({ side: line.side, lineNumber: line.line, metadata: line.key }));
  return outdated.length > 0 ? [{ side: topSide, lineNumber: 0, metadata: OUTDATED_ROW }, ...rows] : rows;
}

/** Where a thread gone to is in the file's diff: at its line, or above the code when outdated; none when not here. */
export function threadPlace(comments: Pick<FileComments, 'lines' | 'outdated'>, threadId: number, topSide: ThreadSide): (ChangedLine & { lineKey?: string }) | null {
  const line = lineOfThread(comments.lines, threadId);
  if (line) return { side: line.side, lineNumber: line.line, lineKey: line.key };
  // Above the first line: scrolling there shows the row at the top of the code.
  if (comments.outdated.some((entry) => entry.thread.root.id === threadId)) return { side: topSide, lineNumber: 1 };
  return null;
}
