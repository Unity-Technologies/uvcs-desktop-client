import { useState } from 'react';
import { useReviewsByBranch } from '../codeReviews/useCodeReviews';
import { NO_TASK_CHOICES, type FinishingTask, type TaskMerge, type TaskMergeChoices } from './taskMerge';

interface FinishingTaskState {
  choices: TaskMergeChoices;
  setChoices: (choices: TaskMergeChoices) => void;
  /**
   * The task with the choices made, and its branch's review, found in the list of reviews the branch chips and the
   * palette share: no `cm` command of its own once those were read.
   */
  finishing: FinishingTask | undefined;
}

/** The merge page's task, if it finishes one: what the user picked to do once merged, and the branch's review. */
export function useFinishingTask(task: TaskMerge | undefined): FinishingTaskState {
  const [choices, setChoices] = useState(task?.choices ?? NO_TASK_CHOICES);
  const { data: reviews } = useReviewsByBranch(task !== undefined);
  const finishing = task && { task: { ...task, choices }, review: reviews?.get(task.branch.id) };
  return { choices, setChoices, finishing };
}
