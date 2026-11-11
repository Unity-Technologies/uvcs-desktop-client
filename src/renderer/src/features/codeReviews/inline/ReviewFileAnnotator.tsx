import type { DiffLineAnnotation } from '@pierre/diffs';
import { History } from 'lucide-react';
import { useContext, useMemo, useState } from 'react';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import type { EntryAnnotatorProps } from '../../diff/entryAnnotator';
import type { ChangedLine } from '../../diff/viewer/changeBlocks';
import { DiffAnnotationsContext, type DiffAnnotations, type LineAction, type LineMarker } from '../../diff/viewer/diffAnnotations';
import type { MapTick } from '../../diff/viewer/mapTicks';
import type { ReviewComments } from './reviewComments';
import { ReviewCommentsContext } from './reviewComments';
import { comparedFile, hasComments, isCommentable, openedOnFocus, openedOnSend } from './fileAnnotation';
import { annotationRowsOf, fileCommentsOf, holdsThread, openedOutdated, OUTDATED_ROW, outdatedKey, threadPlace, topSideOf, versionsToRead, type FileComments } from './fileComments';
import type { ContextView } from './commentContext';
import { reviewDiffViewOf, type LineThread, type VersionText } from './fileThreads';
import { CommentMarkerContent } from './CommentMarkerContent';
import { CommentsInCodeButton } from './CommentsInCodeButton';
import { InlineThreads, OutdatedThreads, ThreadsRow } from './InlineThreads';
import { NewLineCommentCard } from './NewLineCommentCard';
import { lineCommentAt, lineCommentLabel, lineRowContent, newLineCommentSpot, newLineCommentsIn, withNewLineCommentBands, withNewLineCommentRows, type NewLineCommentSpot } from './newLineComment';
import { useNewLineCommentsStore } from './newLineCommentsStore';
import { useReviewCommentsStore } from './reviewCommentsStore';
import { commentMapTicks, commentMapTip } from './commentMapTicks';
import { markerTip } from './markerTip';
import { outdatedMarkerOf, type OutdatedMarker } from './outdatedMarker';
import { markerIsOpen, markerLabel, shownThreadRows, type LineThreads } from './threadRows';
import { lineBandsOf, scrollsToFocus, threadOpenedFrom } from './threadSelection';
import { useFileVersionTexts } from './useFileVersionTexts';

const NO_REVISIONS: number[] = [];

/**
 * A file of a review's diff with the review's comments in its code (`EntryAnnotatorContext`, given by its Changes tab):
 * each thread under its line, the outdated ones above the code; while comments are hidden, a marker on each line, and
 * one on the code's first row for the outdated ones (`outdatedMarkerOf`), shown when it's clicked or one is gone to.
 * Shown or hidden, each spot is ticked in the diff's change map (`commentMapTicks`). A line of the revision the diff
 * comments on takes a new comment (`lineCommentAt`), from the "+" in its gutter or the code's menu, written under it
 * (`NewLineCommentCard`), kept while the window lives (`useNewLineCommentsStore`).
 * One on an earlier version is seen in context in a dialog (`ReviewComments.seeInContext`), which leaves this diff as
 * it is.
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
  const readKey = toRead.map((revision) => `${revision}:${readStateOf(textOf(revision))}`).join(',');
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
    const next = openedOnFocus(openedKeys, focus, focusPlace.lineKey, inCode);
    if (next !== openedKeys) setOpened({ path: entry.path, keys: next });
  }
  // A new place to scroll to only when a thread is gone to: a refetch, a line opened, comments hidden or a card picked
  // in the code (`inPlace`, on screen already) scroll nothing.
  const scrollTo = useMemo(
    () => (focusPlace && scrollsToFocus(focus) ? { side: focusPlace.side, lineNumber: focusPlace.lineNumber } : null),
    [focus?.seq, focus?.inPlace, focusPlace?.side, focusPlace?.lineNumber],
  );

  // Gone to from elsewhere (the conversation), the file opens at the thread, even while its place is still worked out.
  const opensAtRow = focus !== null && holdsThread(fileComments, focus.threadId);
  // Its own list only when the file's comments change: a new one places the change map's ticks again.
  const mapTicks = useMemo(() => (fileComments ? commentMapTicks(fileComments, topSide) : NO_TICKS), [fileComments, topSide]);
  // The comments being written in this file, and the line action that starts one: its own memo, as Pierre takes it
  // in its options, and new options lay the diff out anew.
  const allSpots = useNewLineCommentsStore((state) => state.spots);
  const openSpot = useNewLineCommentsStore((state) => state.open);
  const spots = useMemo(() => (comments && view && threads ? newLineCommentsIn(allSpots, comments.review.id, view, file) : NO_SPOTS), [allSpots, comments, threads, fileKey]);
  const reviewId = comments?.review.id;
  const lineAction = useMemo<LineAction | undefined>(() => {
    if (reviewId === undefined || !view || !threads) return undefined;
    return {
      offers: (line: ChangedLine) => lineCommentAt(view, file, line) !== null,
      label: lineCommentLabel,
      run: (line: ChangedLine) => {
        const at = lineCommentAt(view, file, line);
        if (at) openSpot(newLineCommentSpot(reviewId, file.path, line.side, at));
      },
    };
  }, [reviewId, threads !== undefined, fileKey, openSpot]);

  const annotations = useMemo<DiffAnnotations | null>(() => {
    if (!comments || !view || !fileComments || !lineAction) return null;
    const shown = shownThreadRows(fileComments.lines, inCode, openedKeys);
    const openLine = (key: string): void => setOpened({ path: entry.path, keys: [...openedKeys, key] });
    const closeLine = (key: string): void => setOpened({ path: entry.path, keys: openedKeys.filter((open) => open !== key) });
    const markers = shown.markers.map((line): LineMarker => ({
      key: line.key,
      side: line.side,
      lineNumber: line.line,
      label: markerLabel(line),
      tip: markerTip(line),
      content: <CommentMarkerContent line={line} />,
      emphasized: markerIsOpen(line),
      // Opened, the line's first thread is the one looked at: selected, as a card clicked is.
      onOpen: () => {
        openLine(line.key);
        comments.selectThread(threadOpenedFrom(line));
      },
    }));
    const outdated = outdatedMarkerOf(fileComments.outdated, openedKeys, inCode);
    if (outdated) markers.push(outdatedLineMarker(outdated, topSide, () => setOpened({ path: entry.path, keys: outdated.opens })));
    const { seeInContext } = comments;
    const onSeeInContext = seeInContext && ((thread: LineThread, startsOn?: ContextView) => seeInContext(thread, { startsOn, onScreen: { view, entry } }));
    // Sent while comments are hidden, the line opens, so the new thread shows where it was written. From the lines open
    // then: others may have opened while it was sent.
    const onSent = (key: string): void =>
      setOpened((now) => (now.path === entry.path ? { path: entry.path, keys: openedOnSend(now.keys, key, inCode) } : now));
    const render = (row: DiffLineAnnotation<string>) =>
      renderRow(row, { comments, fileComments, focus, textOf, shownLines: shown.rows, spots, onSent, opened: inCode ? undefined : openedKeys, onClose: inCode ? undefined : closeLine, onSeeInContext });
    const mapTickTip = (keys: readonly string[]): string => commentMapTip(fileComments, keys);
    const bands = withNewLineCommentBands(lineBandsOf(fileComments.lines, focus), spots);
    const rows = withNewLineCommentRows(annotationRowsOf(shown, fileComments.outdated, topSide, inCode ? undefined : openedKeys), spots);
    return { rows, render, markers, mapTicks, mapTickTip, scrollTo, opensAtRow, bands, lineAction };
  }, [comments, entry, fileComments, inCode, openedKeys, topSide, mapTicks, scrollTo, opensAtRow, spots, lineAction]);

  const controls = hasComments(fileComments) && <CommentsInCodeButton shown={inCode} onChange={setInCode} />;
  return <DiffAnnotationsContext.Provider value={annotations}>{children({ controls })}</DiffAnnotationsContext.Provider>;
}

const NO_KEYS: readonly string[] = [];

const NO_SPOTS: readonly NewLineCommentSpot[] = [];

const NO_TICKS: readonly MapTick[] = [];

/** What changes the file's comments as its versions arrive: each version read, still read, or failed. */
function readStateOf(text: VersionText): string {
  return text === undefined ? 'reading' : text === null ? 'failed' : 'read';
}

/** The outdated threads' marker, on the first row of the code (`lineNumber: 0`): what they're about on hover. */
function outdatedLineMarker(outdated: OutdatedMarker, side: LineThreads['side'], onOpen: () => void): LineMarker {
  return {
    key: OUTDATED_ROW,
    side,
    lineNumber: 0,
    label: outdated.label,
    tip: outdated.tip,
    content: <CommentMarkerContent line={outdated} icon={<History size={12} aria-hidden />} />,
    emphasized: outdated.emphasized,
    onOpen,
  };
}

interface RowContext {
  comments: ReviewComments;
  fileComments: FileComments;
  focus: ReviewComments['focus'];
  textOf: (revisionId: number) => VersionText;
  /** The lines whose threads show (opened, while comments are hidden): a line being commented on may show only the new one. */
  shownLines: readonly LineThreads[];
  /** The comments being written in the file, each under its line. */
  spots: readonly NewLineCommentSpot[];
  onSent: (lineKey: string) => void;
  /** What was opened while comments are hidden (lines, outdated threads); none while they show in the code. */
  opened?: readonly string[];
  /** Folds a line opened from its marker (or an outdated thread gone to) back; none while comments show in the code. */
  onClose?: (key: string) => void;
  /** Shows a thread in context, on a view; none until the place's repository is known. */
  onSeeInContext?: (thread: LineThread, startsOn?: ContextView) => void;
}

function renderRow(row: DiffLineAnnotation<string>, context: RowContext) {
  const { comments, fileComments, focus } = context;
  if (row.metadata === OUTDATED_ROW) {
    return (
      <OutdatedThreads
        comments={comments}
        outdated={context.opened ? openedOutdated(fileComments.outdated, context.opened) : fileComments.outdated}
        focus={focus}
        textOf={context.textOf}
        onHide={context.onClose && ((thread) => context.onClose!(outdatedKey(thread.root.id)))}
        onSeeInContext={context.onSeeInContext}
      />
    );
  }
  const { line, spot } = lineRowContent(row.metadata, context.shownLines, context.spots);
  const newComment = spot && <NewLineCommentCard key={spot.key} spot={spot} onSent={() => context.onSent(row.metadata)} />;
  if (!line) return newComment ? <ThreadsRow>{newComment}</ThreadsRow> : null;
  return (
    <InlineThreads comments={comments} line={line} focus={focus} onClose={context.onClose && (() => context.onClose!(line.key))} onSeeInContext={context.onSeeInContext}>
      {newComment}
    </InlineThreads>
  );
}
