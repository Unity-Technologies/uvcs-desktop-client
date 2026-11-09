import type { DiffLineAnnotation } from '@pierre/diffs';
import { MessageSquare, MessageSquareOff } from 'lucide-react';
import { useContext, useMemo, useState } from 'react';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import { IconButton } from '../../../ui/IconButton';
import type { EntryAnnotatorProps } from '../../diff/entryAnnotator';
import { DiffAnnotationsContext, type DiffAnnotations, type LineMarker } from '../../diff/viewer/diffAnnotations';
import type { ReviewComments } from './reviewComments';
import { ReviewCommentsContext } from './reviewComments';
import { openCommentContextDialog } from './CommentContextDialog';
import { comparedFile, hasComments, isCommentable, markerCount, openedOnFocus } from './fileAnnotation';
import { annotationRowsOf, fileCommentsOf, holdsThread, OUTDATED_ROW, threadPlace, topSideOf, versionsToRead, type FileComments } from './fileComments';
import { reviewDiffViewOf, type LineThread } from './fileThreads';
import { InlineThreads, OutdatedThreads } from './InlineThreads';
import { useReviewCommentsStore } from './reviewCommentsStore';
import { markerIsOpen, markerLabel, shownThreadRows } from './threadRows';
import { useFileVersionTexts } from './useFileVersionTexts';

const NO_REVISIONS: number[] = [];

/**
 * A file of a review's diff with the review's comments in its code (`EntryAnnotatorContext`, given by its Changes tab):
 * each thread under its line, the outdated ones above the code; while comments are hidden, a marker on each line, and
 * the outdated ones only when one of them is gone to. One on an earlier version is seen in context in a dialog
 * (`openCommentContextDialog`), which leaves this diff as it is.
 */
export function ReviewFileAnnotator({ target, entry, children }: EntryAnnotatorProps) {
  const comments = useContext(ReviewCommentsContext);
  const place = usePlace();
  const placeRepository = usePlaceRepository();
  const inCode = useReviewCommentsStore((state) => state.inCode);
  const setInCode = useReviewCommentsStore((state) => state.setInCode);
  // Per file: the lines opened while comments are hidden are a way to read one file.
  const [opened, setOpened] = useState<{ path: string; keys: readonly string[] }>({ path: entry.path, keys: NO_KEYS });
  const openedKeys = opened.path === entry.path ? opened.keys : NO_KEYS;

  const threads = comments && isCommentable(entry, placeRepository) ? comments.threads : undefined;
  const file = comparedFile(entry);
  const view = comments ? reviewDiffViewOf(comments.review.target, target) : null;
  const fileKey = JSON.stringify([view, file]);
  // The earlier versions threads were written on, and the newer side's text, only when there are such threads.
  const toRead = useMemo(() => (threads && comments && view ? versionsToRead({ threads, review: comments.review.target, view, file }) : NO_REVISIONS), [threads, fileKey]);
  const textOf = useFileVersionTexts(place, entry.repository, entry.path, toRead);
  const readKey = toRead.map((revision) => `${revision}:${textOf(revision) === undefined ? 0 : 1}`).join(',');
  const fileComments = useMemo(
    () => (threads && comments && view ? fileCommentsOf({ threads, review: comments.review.target, view, file, textOf }) : null),
    [threads, fileKey, readKey],
  );

  const topSide = topSideOf(file);
  const focus = comments?.focus ?? null;
  const focusPlace = focus && fileComments ? threadPlace(fileComments, focus.threadId, topSide) : null;
  // Gone to while comments are hidden: its line opens, once per time it's gone to.
  const [openedFor, setOpenedFor] = useState<number | null>(null);
  if (focus && focusPlace && openedFor !== focus.seq) {
    setOpenedFor(focus.seq);
    const next = openedOnFocus(openedKeys, focusPlace.lineKey, inCode);
    if (next !== openedKeys) setOpened({ path: entry.path, keys: next });
  }
  // A new place to scroll to only when a thread is gone to: a refetch, a line opened or comments hidden scroll nothing.
  const scrollTo = useMemo(
    () => (focusPlace ? { side: focusPlace.side, lineNumber: focusPlace.lineNumber } : null),
    [focus?.seq, focusPlace?.side, focusPlace?.lineNumber],
  );

  // Gone to from elsewhere (the conversation), the file opens at the thread, even while its place is still worked out.
  const opensAtRow = focus !== null && holdsThread(fileComments, focus.threadId);
  const annotations = useMemo<DiffAnnotations | null>(() => {
    if (!comments || !view || !fileComments || (!hasComments(fileComments) && !opensAtRow)) return null;
    const shown = shownThreadRows(fileComments.lines, inCode, openedKeys);
    const openLine = (key: string): void => setOpened({ path: entry.path, keys: [...openedKeys, key] });
    const closeLine = (key: string): void => setOpened({ path: entry.path, keys: openedKeys.filter((open) => open !== key) });
    const markers = shown.markers.map((line): LineMarker => ({
      key: line.key,
      side: line.side,
      lineNumber: line.line,
      label: markerLabel(line),
      content: (
        <>
          <MessageSquare size={11} aria-hidden />
          {markerCount(line)}
        </>
      ),
      emphasized: markerIsOpen(line),
      onOpen: () => openLine(line.key),
    }));
    const onSeeInContext = (thread: LineThread): void =>
      openCommentContextDialog({ review: comments.review, thread, user: comments.user, shown: entry, view, showInConversation: () => comments.showInConversation(thread.root.id) });
    const render = (row: DiffLineAnnotation<string>) => renderRow(row, { comments, fileComments, focus, textOf, onClose: inCode ? undefined : closeLine, onSeeInContext });
    return { rows: annotationRowsOf(shown, fileComments.outdated, topSide, inCode ? undefined : openedKeys), render, markers, scrollTo, opensAtRow };
  }, [comments, entry, fileComments, inCode, openedKeys, topSide, scrollTo, opensAtRow]);

  // One label for a pressed toggle: its state is `aria-pressed`, and the icon.
  const controls = hasComments(fileComments) && (
    <IconButton icon={inCode ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />} label="Comments in the code" aria-pressed={inCode} onClick={() => setInCode(!inCode)} />
  );
  return <DiffAnnotationsContext.Provider value={annotations}>{children({ controls })}</DiffAnnotationsContext.Provider>;
}

const NO_KEYS: readonly string[] = [];

interface RowContext {
  comments: ReviewComments;
  fileComments: FileComments;
  focus: ReviewComments['focus'];
  textOf: (revisionId: number) => string | undefined;
  /** Folds a line opened from its marker (or the outdated threads gone to) back; none while comments show in the code. */
  onClose?: (key: string) => void;
  onSeeInContext: (thread: LineThread) => void;
}

function renderRow(row: DiffLineAnnotation<string>, context: RowContext) {
  const { comments, fileComments, focus } = context;
  if (row.metadata === OUTDATED_ROW) {
    return (
      <OutdatedThreads
        comments={comments}
        outdated={fileComments.outdated}
        focus={focus}
        textOf={context.textOf}
        onClose={context.onClose && (() => context.onClose!(OUTDATED_ROW))}
        onSeeInContext={context.onSeeInContext}
      />
    );
  }
  const line = fileComments.lines.find((candidate) => candidate.key === row.metadata);
  if (!line) return null;
  return <InlineThreads comments={comments} line={line} focus={focus} onClose={context.onClose && (() => context.onClose!(line.key))} onSeeInContext={context.onSeeInContext} />;
}
