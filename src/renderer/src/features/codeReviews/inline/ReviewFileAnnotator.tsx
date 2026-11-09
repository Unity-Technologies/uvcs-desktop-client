import type { DiffLineAnnotation } from '@pierre/diffs';
import { History, MessageSquare, MessageSquareOff } from 'lucide-react';
import { useContext, useMemo, useState } from 'react';
import { otherRepository } from '@shared/domain/repository';
import { usePlace, usePlaceRepository } from '../../../app/workspace/useWorkspace';
import { Button } from '../../../ui/Button';
import { IconButton } from '../../../ui/IconButton';
import type { EntryAnnotatorProps } from '../../diff/entryAnnotator';
import { DiffAnnotationsContext, type DiffAnnotations, type LineMarker } from '../../diff/viewer/diffAnnotations';
import type { ReviewComments } from './reviewComments';
import { ReviewCommentsContext } from './reviewComments';
import { annotationRowsOf, fileCommentsOf, OUTDATED_ROW, showsCommentControls, threadPlace, topSideOf, versionsToRead, type FileComments } from './fileComments';
import { reviewDiffViewOf, type ShownFile } from './fileThreads';
import { InlineThreads, OutdatedThreads } from './InlineThreads';
import { useReviewCommentsStore } from './reviewCommentsStore';
import { markerIsOpen, markerLabel, shownThreadRows } from './threadRows';
import { useFileVersionTexts } from './useFileVersionTexts';

const NO_REVISIONS: number[] = [];

/**
 * A file of a review's diff with the review's comments in its code (`EntryAnnotatorContext`, given by its Changes tab):
 * each thread under its line, the outdated ones above the code, or a marker on each line while comments are hidden;
 * and "Changes since this comment", which compares the version a thread was written on with the newest.
 */
export function ReviewFileAnnotator({ target, entry, children }: EntryAnnotatorProps) {
  const comments = useContext(ReviewCommentsContext);
  const place = usePlace();
  const placeRepository = usePlaceRepository();
  const inCode = useReviewCommentsStore((state) => state.inCode);
  const setInCode = useReviewCommentsStore((state) => state.setInCode);
  // Per file: comparing since a comment, and the lines opened while comments are hidden, are ways to read one file.
  const [since, setSince] = useState<{ path: string; revisionId: number } | null>(null);
  const [opened, setOpened] = useState<{ path: string; keys: ReadonlySet<string> }>({ path: entry.path, keys: new Set() });
  const sinceRevision = since?.path === entry.path ? since.revisionId : null;
  const openedKeys = opened.path === entry.path ? opened.keys : NO_KEYS;

  // Items under an xlink are another repository's: the review can't comment on them.
  const commentable = comments !== null && entry.itemType !== 'directory' && otherRepository(entry.repository, placeRepository) === undefined;
  const file: ShownFile = { path: entry.path, oldPath: entry.oldPath, originalRevision: sinceRevision ?? entry.baseRevisionId, modifiedRevision: entry.revisionId };
  const view = comments ? reviewDiffViewOf(comments.review.target, target) : null;
  const threads = commentable ? comments.threads : undefined;
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
  // Gone to while comments are hidden: its line opens.
  const [openedFor, setOpenedFor] = useState<number | null>(null);
  if (focus && focusPlace?.lineKey && !inCode && openedFor !== focus.seq) {
    setOpenedFor(focus.seq);
    setOpened({ path: entry.path, keys: new Set([...openedKeys, focusPlace.lineKey]) });
  }

  const annotations = useMemo<DiffAnnotations | null>(() => {
    if (!comments || !fileComments || (fileComments.lines.length === 0 && fileComments.outdated.length === 0)) return null;
    const shown = shownThreadRows(fileComments.lines, inCode, openedKeys);
    const openLine = (key: string): void => setOpened({ path: entry.path, keys: new Set([...openedKeys, key]) });
    const closeLine = (key: string): void => setOpened({ path: entry.path, keys: new Set([...openedKeys].filter((open) => open !== key)) });
    const markers = shown.markers.map((line): LineMarker => ({
      key: line.key,
      side: line.side,
      lineNumber: line.line,
      label: markerLabel(line),
      content: (
        <>
          <MessageSquare size={11} aria-hidden />
          {line.threads.length > 1 && line.threads.length}
        </>
      ),
      emphasized: markerIsOpen(line),
      onOpen: () => openLine(line.key),
    }));
    const render = (row: DiffLineAnnotation<string>) =>
      renderRow(row, { comments, fileComments, inCode, focus, textOf, onClose: inCode ? undefined : closeLine, onChangesSince: (revisionId) => setSince({ path: entry.path, revisionId }) });
    return {
      rows: annotationRowsOf(shown, fileComments.outdated, topSide),
      render,
      markers,
      scrollTo: focusPlace ? { side: focusPlace.side, lineNumber: focusPlace.lineNumber } : null,
    };
    // A new place to scroll to only when a thread is gone to (`focus.seq`), not at every render.
  }, [comments, fileComments, inCode, openedKeys, topSide, focus?.seq, focusPlace?.lineNumber, focusPlace?.side]);

  const controls = showsCommentControls(fileComments, sinceRevision !== null) && (
    <>
      {sinceRevision !== null && (
        <Button size="small" variant="secondary" icon={<History size={13} />} aria-pressed data-tip="Show all the changes to this file" onClick={() => setSince(null)}>
          Since comment
        </Button>
      )}
      <IconButton
        icon={inCode ? <MessageSquare size={14} /> : <MessageSquareOff size={14} />}
        label={inCode ? 'Hide comments in the code' : 'Show comments in the code'}
        aria-pressed={inCode}
        onClick={() => setInCode(!inCode)}
      />
    </>
  );
  const original = sinceRevision === null ? undefined : { kind: 'revision' as const, revision: { revisionId: sinceRevision, repository: entry.repository }, fileName: entry.path };
  return <DiffAnnotationsContext.Provider value={annotations}>{children({ original, controls })}</DiffAnnotationsContext.Provider>;
}

const NO_KEYS: ReadonlySet<string> = new Set();

interface RowContext {
  comments: ReviewComments;
  fileComments: FileComments;
  inCode: boolean;
  focus: ReviewComments['focus'];
  textOf: (revisionId: number) => string | undefined;
  /** Folds a line opened from its marker back into it; none while comments show in the code. */
  onClose?: (key: string) => void;
  onChangesSince: (revisionId: number) => void;
}

function renderRow(row: DiffLineAnnotation<string>, context: RowContext) {
  const { comments, fileComments, focus } = context;
  if (row.metadata === OUTDATED_ROW) {
    return <OutdatedThreads comments={comments} outdated={fileComments.outdated} focus={focus} textOf={context.textOf} onChangesSince={context.onChangesSince} />;
  }
  const line = fileComments.lines.find((candidate) => candidate.key === row.metadata);
  if (!line) return null;
  return <InlineThreads comments={comments} line={line} focus={focus} onClose={context.onClose && (() => context.onClose!(line.key))} onChangesSince={context.onChangesSince} />;
}
