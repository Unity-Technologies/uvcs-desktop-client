import { ArrowLeft, FileDiff } from 'lucide-react';
import { canAnnotate } from '@shared/domain/annotate';
import type { ItemRevision } from '@shared/domain/history';
import { hotkey } from '../../lib/shortcutRegistry';
import { useSettledValue } from '../../lib/useSettled';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { AnnotationPane, type AnnotationHistory } from '../annotate/AnnotationPane';
import { FileViewSwitch } from '../annotate/FileViewSwitch';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { comparedRevisions } from './comparedRevisions';
import { RevisionComparison } from './RevisionComparison';
import { shownRevisionView, type RevisionView } from './revisionView';

interface RevisionDetailsProps {
  path: string;
  /** All revisions, newest first. */
  revisions: ItemRevision[];
  selected: ItemRevision[];
  /** Walks back from a revision "Annotate before this change" selected. */
  onBack?: () => void;
  history: AnnotationHistory;
  /** The repository of a file under an xlink, whose changesets no diff of the workspace's has. */
  otherRepository?: string;
  /** The view picked: the page's, which starts as the one it was opened with. */
  picked: RevisionView;
  onPick: (view: RevisionView) => void;
}

/**
 * The selected revision as a diff or annotated, in one pane with a switch between the two (remembered). One selected
 * revision is compared with the one it was made from; two selected revisions with each other, and the newer one is
 * annotated. Directories have no content, so their changeset is offered instead.
 */
export function RevisionDetails({ path, revisions, selected, onBack, history, otherRepository, picked, onPick }: RevisionDetailsProps) {
  const compared = comparedRevisions(revisions, selected);
  // Arrowing through the history doesn't read (`cm cat`, `cm annotate`) every revision it passes.
  const [newer, older] = useSettledValue(compared, compared.map((revision) => revision?.revisionId).join(':'));

  if (!newer) return <EmptyState title="Select a revision" description="Select two revisions to compare them with each other." />;

  if (newer.itemType === 'directory') {
    return (
      <EmptyState
        title={`Changeset ${newer.changesetId}`}
        description={
          otherRepository
            ? `Directories have no content to compare. The changeset is one of ${otherRepository}.`
            : 'Directories have no content to compare. Open the changeset to see what changed inside.'
        }
        action={
          !otherRepository && (
            <Button icon={<FileDiff size={14} />} onClick={() => openChangesetDiff({ id: newer.changesetId })}>
              Diff changeset
            </Button>
          )
        }
      />
    );
  }

  const view = shownRevisionView(picked, newer.itemType);
  const leading = (
    <>
      {/* Binary revisions have nothing to annotate: only their diff (an image comparison, or their sizes) shows. */}
      {canAnnotate(newer.itemType) && (
        <FileViewSwitch
          value={view}
          onChange={onPick}
          tips={{ diff: 'What this revision changed', annotate: 'Who last changed each line, as of this revision' }}
          shortcut={hotkey('historyToggleView')}
        />
      )}
      {onBack && (
        <Button size="small" variant="ghost" icon={<ArrowLeft size={13} />} data-tip="The revision annotated before" onClick={onBack}>
          Back
        </Button>
      )}
    </>
  );

  return view === 'diff' ? (
    <RevisionComparison path={path} newer={newer} older={older} leading={leading} />
  ) : (
    <AnnotationPane path={path} repository={newer.repository} revision={newer} leading={leading} history={history} />
  );
}
