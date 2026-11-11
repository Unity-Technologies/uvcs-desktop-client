import { Suspense, useContext, useState, type ReactNode } from 'react';
import type { Place } from '@shared/domain/place';
import type { DiffEntry, DiffTarget } from '@shared/domain/diff';
import { EmptyState } from '../../ui/EmptyState';
import { SinceReviewButton } from '../review/SinceReviewButton';
import { describeDiffEntry, diffEntrySources, diffEntryStatus, permissionsNote } from './diffEntrySources';
import { EntryAnnotatorContext, type AnnotatedEntry } from './entryAnnotator';
import { reviewedRevisionToCompare, type DiffReviewMarks } from './review/diffReview';
import { DiffFileTitle } from './viewer/DiffFileTitle';
import { FileDiffViewer } from './viewer/FileDiffViewer';
import { ONLY_MOVED } from './viewer/movedFrom';
import { XlinkDiff } from './XlinkDiff';

interface EntryDiffProps {
  place: Place;
  target: DiffTarget;
  entry: DiffEntry;
  /** The diff's files, for an xlink's: the ones under it. */
  entries: readonly DiffEntry[];
  /** Selects another of the diff's files, from an xlink's. */
  onOpen: (entry: DiffEntry) => void;
  /** The revisions reviewed: a file changed since its review can show just what changed after it ("Since review"). */
  reviewMarks: DiffReviewMarks;
  /** The ".meta" toggle of an asset whose Unity `.meta` changed with it (`MetaDiffButton`), beside the diff's controls. */
  metaToggle?: ReactNode;
  /** Whether `entry` is the `.meta` shown for its asset: it has no review of its own to compare with. */
  showsMeta?: boolean;
}

/**
 * The diff of one file of a committed diff (`DiffBrowser`); a folder only says what happened to it, and an xlink where
 * it points (`XlinkDiff`). An asset's `.meta` shows in its place while `metaToggle` is pressed.
 */
export function EntryDiff({ place, target, entry, entries, onOpen, reviewMarks, metaToggle, showsMeta = false }: EntryDiffProps) {
  // Per file: "Since review" is a way to look at one file, not a mode that follows the selection.
  const [sinceReviewPath, setSinceReviewPath] = useState<string | null>(null);
  const Annotator = useContext(EntryAnnotatorContext);

  // Its content is the same on both sides, whatever it is (a text, a binary, an image, a folder): nothing to read.
  const permissions = permissionsNote(entry);
  if (permissions) return <EmptyState title={entry.path} description={permissions} action={metaToggle} />;
  if (entry.itemType === 'directory') {
    return <EmptyState title={entry.path} description={`Directory · ${describeDiffEntry(entry)}`} action={metaToggle} />;
  }
  if (entry.itemType === 'xlink') {
    return <XlinkDiff place={place} target={target} xlink={entry} entries={entries} onOpen={onOpen} />;
  }

  const sources = diffEntrySources(entry);
  const viewer = ({ controls, compared }: AnnotatedEntry) => {
    const reviewedToOffer = showsMeta || compared ? null : reviewedRevisionToCompare(reviewMarks, entry);
    const sinceReview = reviewedToOffer !== null && sinceReviewPath === entry.path;
    return (
      <FileDiffViewer
        place={place}
        original={compared?.original ?? (sinceReview ? { kind: 'revision', revision: { revisionId: reviewedToOffer, repository: entry.repository }, fileName: entry.path } : sources.original)}
        modified={compared?.modified ?? sources.modified}
        fileName={entry.path}
        title={<DiffFileTitle status={diffEntryStatus(entry)} path={entry.path} oldPath={entry.oldPath} />}
        identicalDescription={sinceReview ? 'The file is back to how it was when you reviewed it.' : entry.oldPath ? ONLY_MOVED : undefined}
        compareControls={
          (reviewedToOffer !== null || metaToggle || controls) && (
            <>
              {controls}
              {reviewedToOffer !== null && <SinceReviewButton pressed={sinceReview} onChange={(pressed) => setSinceReviewPath(pressed ? entry.path : null)} />}
              {metaToggle}
            </>
          )
        }
      />
    );
  };
  if (!Annotator) return viewer({});
  // An annotator may load on first use (`lazyComponent`), as the viewer does: nothing shows meanwhile, as for the viewer.
  return (
    <Suspense fallback={null}>
      <Annotator target={target} entry={entry}>
        {viewer}
      </Annotator>
    </Suspense>
  );
}
