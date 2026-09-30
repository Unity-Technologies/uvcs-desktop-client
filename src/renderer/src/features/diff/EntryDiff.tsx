import { useState } from 'react';
import type { DiffEntry } from '@shared/domain/diff';
import { EmptyState } from '../../ui/EmptyState';
import { SinceReviewButton } from '../review/SinceReviewButton';
import { describeDiffEntry, diffEntrySources, diffEntryTone } from './diffEntrySources';
import { reviewedRevisionToCompare, type DiffReviewMarks } from './review/diffReview';
import { DiffFileTitle } from './viewer/DiffFileTitle';
import { FileDiffViewer } from './viewer/FileDiffViewer';
import { ONLY_MOVED } from './viewer/movedFrom';

interface EntryDiffProps {
  workspacePath: string;
  entry: DiffEntry;
  /** The revisions reviewed: a file changed since its review can show just what changed after it ("Since review"). */
  reviewMarks: DiffReviewMarks;
}

/** The diff of one file of a committed diff (`DiffBrowser`); a folder only says what happened to it. */
export function EntryDiff({ workspacePath, entry, reviewMarks }: EntryDiffProps) {
  // Per file: "Since review" is a way to look at one file, not a mode that follows the selection.
  const [sinceReviewPath, setSinceReviewPath] = useState<string | null>(null);

  if (entry.itemType === 'directory') {
    return <EmptyState title={entry.path} description={`Directory · ${describeDiffEntry(entry)}`} />;
  }

  const reviewedRevision = reviewedRevisionToCompare(reviewMarks, entry);
  const sinceReview = reviewedRevision !== null && sinceReviewPath === entry.path;
  const sources = diffEntrySources(entry);
  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={sinceReview ? { kind: 'revision', revision: { revisionId: reviewedRevision, repository: entry.repository }, fileName: entry.path } : sources.original}
      modified={sources.modified}
      fileName={entry.path}
      title={<DiffFileTitle tone={diffEntryTone(entry)} status={describeDiffEntry(entry)} path={entry.path} oldPath={entry.oldPath} />}
      identicalDescription={sinceReview ? 'The file is back to how it was when you reviewed it.' : entry.oldPath ? ONLY_MOVED : undefined}
      compareControls={
        reviewedRevision !== null && <SinceReviewButton pressed={sinceReview} onChange={(pressed) => setSinceReviewPath(pressed ? entry.path : null)} />
      }
    />
  );
}
