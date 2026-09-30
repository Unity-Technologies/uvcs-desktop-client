import { CheckCircle2, EyeOff, GitBranchPlus, GitBranch, X } from 'lucide-react';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { switchToBranch } from '../branches/branchOperations';
import { openCreateBranchDialog } from '../branches/CreateBranchDialog';
import { useFinishedTasksStore, type FinishedTask } from './finishedTask';
import { hideTaskBranch } from './mergeTaskOperations';
import styles from './FinishedTaskCard.module.css';

/** Closes the loop once a task is merged: where it landed, and the next steps (back to the parent, a new task, tidy up). */
export function FinishedTaskCard({ workspacePath, task }: { workspacePath: string; task: FinishedTask }) {
  const { remember, dismiss } = useFinishedTasksStore();

  const hide = async (): Promise<void> => {
    if (await hideTaskBranch(workspacePath, task.branch)) {
      remember(workspacePath, { ...task, hidden: true });
    }
  };

  const startNext = (): void =>
    void openCreateBranchDialog(workspacePath, {
      parentBranch: task.destination,
      startingPoint: `cs:${task.changesetId}`,
      startingPointLabel: `changeset ${task.changesetId} (the merge)`,
    });

  return (
    <div className={styles.card} role="status">
      <div className={styles.message}>
        <CheckCircle2 size={15} className={styles.check} />
        <span>
          Merged into {task.destination} as cs:{task.changesetId}
        </span>
        <IconButton icon={<X size={13} />} label="Dismiss" onClick={() => dismiss(task)} />
      </div>
      <div className={styles.actions}>
        <Button size="small" variant="primary" icon={<GitBranch size={13} />} onClick={() => void switchToBranch(workspacePath, task.destination)}>
          Switch to {task.destination}
        </Button>
        <Button size="small" icon={<GitBranchPlus size={13} />} onClick={startNext}>
          Start next task…
        </Button>
        {!task.hidden && (
          <Button size="small" variant="ghost" icon={<EyeOff size={13} />} onClick={() => void hide()}>
            Hide branch
          </Button>
        )}
      </div>
    </div>
  );
}
