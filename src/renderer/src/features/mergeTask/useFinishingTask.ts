import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { usePlaceUser } from '../../app/account/accounts';
import { usePlace } from '../../app/workspace/useWorkspace';
import { branchReviewsQuery } from '../codeReviews/changeRequests/useChangeRequests';
import { reviewStandingFor } from '../codeReviews/reviewsByBranch';
import { NO_TASK_CHOICES, type FinishingTask, type TaskMerge, type TaskMergeChoices } from './taskMerge';

interface FinishingTaskState {
  choices: TaskMergeChoices;
  setChoices: (choices: TaskMergeChoices) => void;
  /**
   * The task with the choices made, the review that stands for its branch and the branch's reviews, whose merge
   * requests the merge finishes: the read Changes makes of the workspace's branch (`branchReviewsQuery`), so a task
   * finished from Changes finds it read.
   */
  finishing: FinishingTask | undefined;
}

/** The merge page's task, if it finishes one: what the user picked to do once merged, its review and its merge requests. */
export function useFinishingTask(task: TaskMerge | undefined): FinishingTaskState {
  const [choices, setChoices] = useState(task?.choices ?? NO_TASK_CHOICES);
  const place = usePlace();
  const { data: reviews } = useQuery({ ...branchReviewsQuery(place, task?.branch.name ?? ''), enabled: task !== undefined });
  const user = usePlaceUser();
  const finishing = task && {
    task: { ...task, choices },
    review: reviews && reviewStandingFor(reviews),
    user,
    reviewsOfBranch: reviews,
  };
  return { choices, setChoices, finishing };
}
