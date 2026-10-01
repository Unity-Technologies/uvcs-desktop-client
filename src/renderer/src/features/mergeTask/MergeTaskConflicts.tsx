import { CircleAlert } from 'lucide-react';
import type { MergePlan } from '@shared/domain/merge';
import { branchLabels } from '../../lib/branchLabels';
import { OptionCards } from '../../ui/OptionCards';
import { conflictPathCards, type ConflictPath } from './conflictPaths';
import { MergeTaskFileList } from './MergeTaskFileList';
import styles from './MergeTaskDialog.module.css';

interface MergeTaskConflictsProps {
  plan: MergePlan;
  /** "2 files conflict", as the outcome describes them. */
  description: string;
  taskBranch: string;
  destination: string;
  currentBranch: string | undefined;
  /** The way picked; offered only when the whole task branch is merged. */
  conflictPath: ConflictPath | null;
  onConflictPathChange: (path: ConflictPath) => void;
  onOpenFile: (path: string) => void;
  onKeepOneSideOnServer: () => void;
}

/** A task that conflicts with its destination: what conflicts, and how to resolve it in the workspace. */
export function MergeTaskConflicts({
  plan,
  description,
  taskBranch,
  destination,
  currentBranch,
  conflictPath,
  onConflictPathChange,
  onOpenFile,
  onKeepOneSideOnServer,
}: MergeTaskConflictsProps) {
  const [taskName, destinationName] = branchLabels(taskBranch, destination);
  return (
    <>
      <p className={styles.summary} data-tone="conflict">
        <CircleAlert size={15} />
        {description}
      </p>
      <p className={styles.explanation}>
        {taskName} and {destinationName} changed the same files. The server can’t ask you how to combine them, so resolve
        them in your workspace, then merge again.
      </p>
      <MergeTaskFileList plan={plan} conflicts onOpen={onOpenFile} />
      {conflictPath && (
        <OptionCards<ConflictPath>
          label="How to resolve them"
          heading
          value={conflictPath}
          onChange={onConflictPathChange}
          cards={conflictPathCards(taskBranch, destination, currentBranch)}
        />
      )}
      <button type="button" className={styles.link} onClick={onKeepOneSideOnServer}>
        Or merge on the server, keeping one side for every conflicting file…
      </button>
    </>
  );
}
