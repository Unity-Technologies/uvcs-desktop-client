import { History } from 'lucide-react';
import { useState } from 'react';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ReviewMark } from '@shared/domain/review';
import { PathLabel } from '../../components/PathLabel';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import { describeKinds } from './changeCategories';
import { changeDiffSources } from './changeDiffSources';
import { changeTone } from './changeTone';

interface ChangeDiffPanelProps {
  workspacePath: string;
  change: PendingChange;
  /** When the file changed since it was reviewed, the diff can show only that. */
  reviewMark?: ReviewMark;
}

export function ChangeDiffPanel({ workspacePath, change, reviewMark }: ChangeDiffPanelProps) {
  // Per file: "Since review" is a way to look at one file, not a mode that follows the selection.
  const [sinceReviewPath, setSinceReviewPath] = useState<string | null>(null);
  const canCompareWithReview = reviewMark?.state === 'changedSinceReview' && reviewMark.hasSnapshot;
  const sinceReview = canCompareWithReview && sinceReviewPath === change.path;

  const title = (
    <>
      <StatusBadge tone={changeTone(change)} title={describeKinds(change)} />
      <PathLabel path={change.path} oldPath={change.oldPath} />
    </>
  );

  if (change.itemType === 'directory') {
    return <EmptyState title={change.path} description={`Directory · ${describeKinds(change)}`} />;
  }

  const sources = changeDiffSources(change);
  const original = sinceReview ? { kind: 'reviewSnapshot' as const, path: change.path } : sources.original;
  const compareControls = canCompareWithReview && (
    <Button
      size="small"
      variant={sinceReview ? 'secondary' : 'ghost'}
      icon={<History size={13} />}
      aria-pressed={sinceReview}
      data-tip={sinceReview ? 'Show all the changes to this file' : 'Show only what changed since you reviewed this file'}
      onClick={() => setSinceReviewPath(sinceReview ? null : change.path)}
    >
      Since review
    </Button>
  );

  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={original}
      modified={sources.modified}
      fileName={change.path}
      title={title}
      identicalDescription={sinceReview ? 'The file is back to how it was when you reviewed it.' : change.oldPath ? `Moved from ${change.oldPath} without content changes.` : undefined}
      compareControls={compareControls}
    />
  );
}
