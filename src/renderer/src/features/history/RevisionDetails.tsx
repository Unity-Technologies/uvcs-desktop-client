import { FileDiff, ScanText } from 'lucide-react';
import { useState } from 'react';
import { canAnnotate } from '@shared/domain/annotate';
import type { ItemRevision } from '@shared/domain/history';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { AnnotationPane } from '../annotate/AnnotationPane';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { RevisionComparison } from './RevisionComparison';

type RevisionView = 'diff' | 'annotate';

interface RevisionDetailsProps {
  path: string;
  /** All revisions, newest first. */
  revisions: ItemRevision[];
  selected: ItemRevision[];
}

/**
 * The selected revision as a diff or annotated. One selected revision is compared with the one before it;
 * two selected revisions with each other, and the newer one is annotated.
 * Directories have no content, so their changeset is offered instead.
 */
export function RevisionDetails({ path, revisions, selected }: RevisionDetailsProps) {
  const [view, setView] = useState<RevisionView>('diff');
  const [newer, older] = comparedRevisions(revisions, selected);

  if (!newer) return <EmptyState title="Select a revision" description="Select two revisions to compare them with each other." />;

  if (newer.itemType === 'directory') {
    return (
      <EmptyState
        title={`Changeset ${newer.changesetId}`}
        description="Directories have no content to compare. Open the changeset to see what changed inside."
        action={
          <Button icon={<FileDiff size={14} />} onClick={() => openChangesetDiff({ id: newer.changesetId })}>
            Diff changeset
          </Button>
        }
      />
    );
  }

  // Binary revisions have nothing to annotate: only their diff (an image comparison, or their sizes) shows.
  if (!canAnnotate(newer.itemType)) return <RevisionComparison path={path} newer={newer} older={older} />;

  const viewSwitch = (
    <SegmentedControl<RevisionView>
      value={view}
      onChange={setView}
      segments={[
        { value: 'diff', label: <><FileDiff size={13} /> Diff</>, title: 'What this revision changed' },
        { value: 'annotate', label: <><ScanText size={13} /> Annotate</>, title: 'Who last changed each line, as of this revision' },
      ]}
    />
  );

  return view === 'diff' ? (
    <RevisionComparison path={path} newer={newer} older={older} leading={viewSwitch} />
  ) : (
    <AnnotationPane key={newer.idSpec} path={path} revision={newer} revisions={revisions} leading={viewSwitch} />
  );
}

function comparedRevisions(revisions: ItemRevision[], selected: ItemRevision[]): [ItemRevision | undefined, ItemRevision | undefined] {
  if (selected.length >= 2) {
    const [first, second] = [...selected].sort((a, b) => b.changesetId - a.changesetId);
    return [first, second];
  }
  const newer = selected[0];
  if (!newer) return [undefined, undefined];
  return [newer, revisions[revisions.indexOf(newer) + 1]];
}
