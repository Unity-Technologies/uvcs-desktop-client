import { FileDiff } from 'lucide-react';
import type { ContentSource } from '@shared/domain/content';
import type { ItemRevision } from '@shared/domain/history';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import styles from './RevisionComparison.module.css';

interface RevisionComparisonProps {
  path: string;
  /** All revisions, newest first. */
  revisions: ItemRevision[];
  selected: ItemRevision[];
}

/**
 * One selected revision is compared with the one before it; two selected revisions with each other.
 * Directories have no content, so their changeset is offered instead.
 */
export function RevisionComparison({ path, revisions, selected }: RevisionComparisonProps) {
  const workspacePath = useWorkspacePath();
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

  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={older ? revisionSource(older, path) : { kind: 'empty' }}
      modified={revisionSource(newer, path)}
      fileName={path}
      title={
        <span className={styles.title}>
          {older ? `cs:${older.changesetId}` : 'Created in'} → <strong>cs:{newer.changesetId}</strong>
        </span>
      }
    />
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

function revisionSource(revision: ItemRevision, path: string): ContentSource {
  return { kind: 'revision', revisionId: revision.revisionId, fileName: path };
}
