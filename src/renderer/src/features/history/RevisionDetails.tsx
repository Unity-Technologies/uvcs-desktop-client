import { ArrowLeft, FileDiff, ScanText } from 'lucide-react';
import { canAnnotate } from '@shared/domain/annotate';
import type { ItemRevision } from '@shared/domain/history';
import { hotkey } from '../../lib/shortcutRegistry';
import { useSettledValue } from '../../lib/useSettled';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { AnnotationPane, type AnnotationHistory } from '../annotate/AnnotationPane';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { parentRevision } from './parentRevision';
import { RevisionComparison } from './RevisionComparison';
import { shownRevisionView, useRevisionView, type RevisionView } from './revisionView';

interface RevisionDetailsProps {
  path: string;
  /** All revisions, newest first. */
  revisions: ItemRevision[];
  selected: ItemRevision[];
  /** Walks back from a revision "Annotate before this change" selected. */
  onBack?: () => void;
  history: AnnotationHistory;
}

/**
 * The selected revision as a diff or annotated, in one pane with a switch between the two (remembered). One selected
 * revision is compared with the one it was made from; two selected revisions with each other, and the newer one is
 * annotated. Directories have no content, so their changeset is offered instead.
 */
export function RevisionDetails({ path, revisions, selected, onBack, history }: RevisionDetailsProps) {
  const { view: picked, setView } = useRevisionView();
  const compared = comparedRevisions(revisions, selected);
  // Arrowing through the history doesn't read (`cm cat`, `cm annotate`) every revision it passes.
  const [newer, older] = useSettledValue(compared, compared.map((revision) => revision?.revisionId).join(':'));

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

  const view = shownRevisionView(picked, newer.itemType);
  const leading = (
    <>
      {/* Binary revisions have nothing to annotate: only their diff (an image comparison, or their sizes) shows. */}
      {canAnnotate(newer.itemType) && (
        <SegmentedControl<RevisionView>
          value={view}
          onChange={setView}
          label="Show the revision as"
          segments={[
            { value: 'diff', label: <><FileDiff size={13} /> Diff</>, title: 'What this revision changed', shortcut: hotkey('historyToggleView') },
            { value: 'annotate', label: <><ScanText size={13} /> Annotate</>, title: 'Who last changed each line, as of this revision', shortcut: hotkey('historyToggleView') },
          ]}
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
    <AnnotationPane path={path} revision={newer} revisions={revisions} leading={leading} history={history} />
  );
}

function comparedRevisions(revisions: ItemRevision[], selected: ItemRevision[]): [ItemRevision | undefined, ItemRevision | undefined] {
  if (selected.length >= 2) {
    const [first, second] = [...selected].sort((a, b) => b.changesetId - a.changesetId);
    return [first, second];
  }
  const newer = selected[0];
  if (!newer) return [undefined, undefined];
  return [newer, parentRevision(revisions, newer)];
}
