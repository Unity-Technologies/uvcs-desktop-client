import type { DiffLineAnnotation } from '@pierre/diffs';
import { History, MessageSquare, MessageSquareOff } from 'lucide-react';
import { useContext, useMemo, useState, type ReactNode } from 'react';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import { pluralize } from '../../../lib/text';
import { displayName } from '../../../lib/userName';
import { AvatarStack } from '../../../ui/AvatarStack';
import { IconButton } from '../../../ui/IconButton';
import type { EntryAnnotatorProps } from '../../diff/entryAnnotator';
import { DiffAnnotationsContext, type DiffAnnotations, type LineBand, type LineMarker } from '../../diff/viewer/diffAnnotations';
import type { MapTick } from '../../diff/viewer/mapTicks';
import type { ReviewComments } from './reviewComments';
import { ReviewCommentsContext } from './reviewComments';
import { comparedFile, hasComments, isCommentable, openedOnFocus } from './fileAnnotation';
import { annotationRowsOf, fileCommentsOf, holdsThread, openedOutdated, OUTDATED_ROW, outdatedKey, threadPlace, topSideOf, versionsToRead, type FileComments } from './fileComments';
import type { ContextView } from './commentContext';
import { reviewDiffViewOf, type LineThread, type VersionText } from './fileThreads';
import { InlineThreads, OutdatedThreads } from './InlineThreads';
import { useReviewCommentsStore } from './reviewCommentsStore';
import { commentMapTicks, commentMapTip } from './commentMapTicks';
import { markerTip } from './markerTip';
import { outdatedMarkerOf, type OutdatedMarker } from './outdatedMarker';
import { markerCommentCount, markerIsOpen, markerLabel, markerPeople, shownThreadRows, type LineThreads, type MarkedThreads } from './threadRows';
import { useFileVersionTexts } from './useFileVersionTexts';

const NO_REVISIONS: number[] = [];

/**
 * A file of a review's diff with the review's comments in its code (`EntryAnnotatorContext`, given by its Changes tab):
 * each thread under its line, the outdated ones above the code; while comments are hidden, a marker on each line, and
 * one on the code's first row for the outdated ones (`outdatedMarkerOf`), shown when it's clicked or one is gone to.
 * Shown or hidden, each spot is ticked in the diff's change map (`commentMapTicks`).
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
  // Its own list only when the file's comments change: a new one places the change map's ticks again.
  const mapTicks = useMemo(() => (fileComments ? commentMapTicks(fileComments, topSide) : NO_TICKS), [fileComments, topSide]);
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
      tip: markerTip(line),
      content: <MarkerContent line={line} />,
      emphasized: markerIsOpen(line),
      onOpen: () => openLine(line.key),
    }));
    const outdated = outdatedMarkerOf(fileComments.outdated, openedKeys, inCode);
    if (outdated) markers.push(outdatedLineMarker(outdated, topSide, () => setOpened({ path: entry.path, keys: outdated.opens })));
    const { seeInContext } = comments;
    const onSeeInContext = seeInContext && ((thread: LineThread, startsOn?: ContextView) => seeInContext(thread, { startsOn, onScreen: { view, entry } }));
    const render = (row: DiffLineAnnotation<string>) => renderRow(row, { comments, fileComments, focus, textOf, opened: inCode ? undefined : openedKeys, onClose: inCode ? undefined : closeLine, onSeeInContext });
    const mapTickTip = (keys: readonly string[]): string => commentMapTip(fileComments, keys);
    const bands = fileComments.lines.map((line) => lineBand(line, focus));
    return { rows: annotationRowsOf(shown, fileComments.outdated, topSide, inCode ? undefined : openedKeys), render, markers, mapTicks, mapTickTip, scrollTo, opensAtRow, bands };
  }, [comments, entry, fileComments, inCode, openedKeys, topSide, mapTicks, scrollTo, opensAtRow]);

  // An action that says what it does, not a pressed state: "Comments in the code" didn't say which way it goes.
  const controls = hasComments(fileComments) && (
    <IconButton
      icon={inCode ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
      label={inCode ? 'Hide comments in the code' : 'Show comments in the code'}
      onClick={() => setInCode(!inCode)}
    />
  );
  return <DiffAnnotationsContext.Provider value={annotations}>{children({ controls })}</DiffAnnotationsContext.Provider>;
}

const NO_KEYS: readonly string[] = [];

/** A line with threads, outlined; selected when it holds the thread gone to. */
function lineBand(line: LineThreads, focus: ReviewComments['focus']): LineBand {
  const selected = focus !== null && line.threads.some(({ thread }) => thread.root.id === focus.threadId);
  return { key: line.key, side: line.side, lineNumber: line.line, selected };
}
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
    content: <MarkerContent line={outdated} icon={<History size={12} aria-hidden />} />,
    emphasized: outdated.emphasized,
    onOpen,
  };
}

/** A marker's content: who wrote there, and how many comments there are, as a pull request's do; the outdated ones', after a clock. */
function MarkerContent({ line, icon }: { line: MarkedThreads; icon?: ReactNode }) {
  const { people, more } = markerPeople(line);
  return (
    <>
      {icon}
      {/* Still: the marker's own tooltip previews its threads (`markerTip`). */}
      <AvatarStack still avatars={people.map((user) => ({ user, tip: displayName(user) }))} size={14} more={more > 0 ? { count: more, tip: pluralize(more, 'other') } : undefined} />
      {markerCommentCount(line)}
    </>
  );
}

interface RowContext {
  comments: ReviewComments;
  fileComments: FileComments;
  focus: ReviewComments['focus'];
  textOf: (revisionId: number) => VersionText;
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
  const line = fileComments.lines.find((candidate) => candidate.key === row.metadata);
  if (!line) return null;
  return <InlineThreads comments={comments} line={line} focus={focus} onClose={context.onClose && (() => context.onClose!(line.key))} onSeeInContext={context.onSeeInContext} />;
}
