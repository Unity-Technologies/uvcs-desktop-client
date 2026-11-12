import type { DiffLineAnnotation } from '@pierre/diffs';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ChangedLine } from '../../diff/viewer/changeBlocks';
import type { ReviewThread } from '../conversation/reviewThreads';
import { earlierRevisions, placeEarlier, settledIn, threadsOfFile, writtenIn, type EarlierThread, type LineThread, type ReviewDiffView, type ShownFile, type ThreadSide, type VersionText } from './fileThreads';
import { newerLineFinder } from './newerLine';
import { lineOfThread, lineThreadsOf, type LineThreads, type ShownThreadRows } from './threadRows';

/** A file's threads as its diff shows them: by line, and those outdated, apart above the code. */
export interface FileComments {
  lines: LineThreads[];
  outdated: EarlierThread[];
  /** On an earlier version not read yet: placed at a line or outdated once every one is. */
  reading: EarlierThread[];
}

interface FileCommentsInput {
  threads: readonly ReviewThread[];
  review: CodeReviewTarget;
  view: ReviewDiffView;
  file: ShownFile;
  /** An earlier version's text once read, the newer side's (`file.modifiedRevision`) among them. */
  textOf: (revisionId: number) => VersionText;
}

/**
 * Where a file's threads show (`threadsOfFile`, `placeEarlier`): those on a version the diff shows at their line, those
 * on an earlier one at their line now when it's unchanged since, the rest outdated. A thread the diff's changeset
 * settled (`settledIn`) goes first where its line was before the fix, on the older side, as "How it was applied" shows
 * it: the fix changed that line, and the changesets between its version and the fix may have moved it, or changed it
 * too, when it goes where that change is (`toItsChange`): the fix is about it. Until the
 * versions are read or fail, their threads wait (none shows outdated, or at a line, only to move a moment later); a
 * side that can't be read places none there.
 */
export function fileCommentsOf({ threads, review, view, file, textOf }: FileCommentsInput): FileComments {
  const { placed, earlier } = threadsOfFile(threads, review, view, file);
  const newer = sideText(file.modifiedRevision, textOf);
  const older = earlier.some((entry) => settledIn(entry.thread, view)) ? sideText(file.originalRevision, textOf) : null;
  const lineInNewer = typeof newer === 'string' ? newerLineFinder(newer) : null;
  const lineInOlder = typeof older === 'string' ? newerLineFinder(older) : null;
  const lineOf = (text: string, thread: LineThread): { side: ThreadSide; line: number } | null => {
    const { line } = thread.root.anchor;
    const before = settledIn(thread, view) && lineInOlder ? lineInOlder(text, line, 'toItsChange') : null;
    if (before !== null) return { side: 'deletions', line: before };
    const now = lineInNewer ? lineInNewer(text, line) : null;
    return now === null ? null : { side: 'additions', line: now };
  };
  const placedEarlier = placeEarlier(
    earlier,
    (revisionId) => (newer === undefined || older === undefined ? undefined : textOf(revisionId)),
    lineOf,
    (thread) => writtenIn(review, thread).kind === view.kind || settledIn(thread, view),
  );
  return { lines: lineThreadsOf([...placed, ...placedEarlier.placed]), outdated: placedEarlier.outdated, reading: placedEarlier.reading };
}

/** A side's text: none for a side the file isn't on. */
function sideText(revisionId: number, textOf: (revisionId: number) => VersionText): VersionText {
  return revisionId === -1 ? null : textOf(revisionId);
}

/**
 * The versions of a file to read to place its threads (`useFileVersionTexts`): those written on an earlier version, the
 * newer side's text to find their lines in, and the older side's when the diff's changeset settled one of them. None
 * when every thread is on a version the diff shows.
 */
export function versionsToRead({ threads, review, view, file }: Omit<FileCommentsInput, 'textOf'>): number[] {
  const { earlier } = threadsOfFile(threads, review, view, file);
  const revisions = earlierRevisions(earlier);
  if (revisions.length === 0) return revisions;
  const sides = [file.modifiedRevision, ...(earlier.some((entry) => settledIn(entry.thread, view)) ? [file.originalRevision] : [])];
  return [...revisions, ...sides.filter((revisionId) => revisionId !== -1 && !revisions.includes(revisionId))];
}

/** The side a file's rows above its code go on: the one it has, the older for a deleted file. */
export function topSideOf(file: Pick<ShownFile, 'modifiedRevision'>): ThreadSide {
  return file.modifiedRevision === -1 ? 'deletions' : 'additions';
}

/** The row above the code holding a file's outdated threads (`lineNumber: 0`). */
export const OUTDATED_ROW = 'outdated';

const OUTDATED_KEY_PREFIX = `${OUTDATED_ROW}:`;

/**
 * What opens an outdated thread while comments are hidden, as a line's key opens its line: each its own, so going to
 * one shows that one, not every outdated thread of the file.
 */
export function outdatedKey(threadId: number): string {
  return `${OUTDATED_KEY_PREFIX}${threadId}`;
}

/** The outdated threads opened while comments are hidden, in the order they were opened. */
export function openedOutdated(outdated: readonly EarlierThread[], opened: readonly string[]): EarlierThread[] {
  return opened.map((key) => outdated.find((entry) => outdatedKey(entry.thread.root.id) === key)).filter((entry): entry is EarlierThread => entry !== undefined);
}

/**
 * Pierre's rows for a file's threads: each line's shown, named by its key (`LineThreads.key`), and the outdated ones
 * above the code, on the side the file has (a deleted file has only its older one).
 *
 * Where a row shows is its line's; its place in the list is only how Pierre keys its slot (by index, in
 * `renderDiffChildren`), and a row whose index changes is mounted anew, an open reply closed. So rows that come later
 * go after: the lines with a thread on a version shown first, then those placed once the earlier versions are read (all
 * at once, `placeEarlier`), then the outdated ones. While comments are hidden (`opened` given), only what was opened
 * shows, in the order it was opened (`shownThreadRows`): the outdated threads opened (`outdatedKey`) in one row, where
 * the first was.
 */
export function annotationRowsOf(shown: Pick<ShownThreadRows, 'rows'>, outdated: readonly EarlierThread[], topSide: ThreadSide, opened?: readonly string[]): DiffLineAnnotation<string>[] {
  const outdatedRow: DiffLineAnnotation<string> | null = outdated.length === 0 ? null : { side: topSide, lineNumber: 0, metadata: OUTDATED_ROW };
  if (opened) {
    const firstOutdated = opened.find((key) => openedOutdated(outdated, [key]).length > 0);
    const rowOpened = (key: string): DiffLineAnnotation<string> | null => {
      if (key.startsWith(OUTDATED_KEY_PREFIX)) return key === firstOutdated ? outdatedRow : null;
      const line = shown.rows.find((candidate) => candidate.key === key);
      return line ? rowOfLine(line) : null;
    };
    const rows = opened.map(rowOpened);
    return rows.filter((row): row is DiffLineAnnotation<string> => row !== null);
  }
  const onShownVersion = (line: LineThreads): boolean => line.threads.some((entry) => entry.earlier === undefined);
  const ordered = [...shown.rows.filter(onShownVersion), ...shown.rows.filter((line) => !onShownVersion(line))];
  const rows = ordered.map(rowOfLine);
  return outdatedRow ? [...rows, outdatedRow] : rows;
}

function rowOfLine(line: LineThreads): DiffLineAnnotation<string> {
  return { side: line.side, lineNumber: line.line, metadata: line.key };
}

/** Where a thread gone to is in the file's diff: at its line, or above the code when outdated; none when not here. */
export function threadPlace(comments: Pick<FileComments, 'lines' | 'outdated'>, threadId: number, topSide: ThreadSide): (ChangedLine & { lineKey: string }) | null {
  const line = lineOfThread(comments.lines, threadId);
  if (line) return { side: line.side, lineNumber: line.line, lineKey: line.key };
  // Above the code (`lineNumber: 0`): the diff scrolls to its top. Opened, while comments are hidden, as a line is.
  if (comments.outdated.some((entry) => entry.thread.root.id === threadId)) return { side: topSide, lineNumber: 0, lineKey: outdatedKey(threadId) };
  return null;
}

/**
 * Whether the file's diff has a thread, at a line, outdated, or still being placed: a diff opened to go to it opens at
 * it, not at its first change (`DiffAnnotations.opensAtRow`), even before its earlier version is read.
 */
export function holdsThread(comments: FileComments | null, threadId: number): boolean {
  if (!comments) return false;
  const isIt = (entry: EarlierThread): boolean => entry.thread.root.id === threadId;
  return lineOfThread(comments.lines, threadId) !== undefined || comments.outdated.some(isIt) || comments.reading.some(isIt);
}
