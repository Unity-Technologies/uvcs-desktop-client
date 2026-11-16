import { useQuery } from '@tanstack/react-query';
import { GitMerge, GitPullRequest } from 'lucide-react';
import type { ReactNode } from 'react';
import { workspacePlace } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { GitPullRequestPlus } from '../../components/GitPullRequestPlus';
import { Button } from '../../ui/Button';
import { useBranch } from '../branches/useBranches';
import { branchReviewsQuery } from '../codeReviews/changeRequests/useChangeRequests';
import { openReview } from '../codeReviews/codeReviewOperations';
import { reviewConversationQuery } from '../codeReviews/conversation/useReviewConversation';
import { openCreateMergeRequestDialog } from '../codeReviews/CreateMergeRequestDialog';
import { openItemsOfConversation } from '../codeReviews/mergeCard';
import { setMergeRequestState } from '../codeReviews/mergeRequestOperations';
import { MergeRequestStateIcon } from '../codeReviews/MergeRequestStateIcon';
import { finishedTaskFor, useFinishedTasksStore } from './finishedTask';
import { FinishedTaskCard } from './FinishedTaskCard';
import { openMergeRequestMerge, openTaskMerge } from './mergeTaskOperations';
import { isTaskBranch } from './mergeTaskSummary';
import { TaskMergeButton } from './TaskMergeButton';
import { conversationToRead, keepsPreviousMergedCheck, mergedCheckDestinationOf, taskNextStepOf, type MergedCheck, taskNextStepView, type TaskNextStepAction, type TaskNextStepLine } from './taskNextStep';
import styles from './MergeTaskSuggestion.module.css';

/**
 * For a clean workspace on a task branch with changesets of its own, the task's next step (`taskNextStepOf`): create
 * its merge request, see where the request stands and move it on, merge it once reviewed; once merged, what to do
 * next. It stays cheap: one `cm find` reads the branch (never the list of every branch), one (limit 1) per branch head
 * tells whether the branch has changesets, and one merge link (limit 1) per head whether that head is already merged
 * where the task merges. The branch's reviews are the read Changes already makes (`branchReviewsQuery`, for the change
 * requests a check-in applies), and so is the conversation that counts a rework's change requests. The merge itself is
 * only previewed once its page opens. `quiet` where it sits under a list: the most useful action alone;
 * `besideAnotherAction` after a check-in, by its Copy link: the line, and that one action.
 */
export function MergeTaskSuggestion({
  workspacePath,
  branchName,
  quiet = false,
  besideAnotherAction = false,
}: {
  workspacePath: string;
  branchName: string;
  quiet?: boolean;
  besideAnotherAction?: boolean;
}) {
  const place = usePlace();
  const branch = useBranch(branchName).data ?? undefined;
  const task = isTaskBranch(branch) ? branch : undefined;
  const { data: hasChangesets } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'mergeTaskHasChangesets', branchName, task?.headChangeset),
    queryFn: async () => (await api.changesets.list(workspacePlace(workspacePath), { branch: branchName, limit: 1 })).length > 0,
    enabled: task !== undefined,
    // Keyed by the branch head: the answer only changes when the head moves, so refreshes skip it.
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  });
  const reviews = useQuery({ ...branchReviewsQuery(place, branchName), enabled: task !== undefined });
  const destination = mergedCheckDestinationOf(task, reviews.data, reviews.isError);
  const check: MergedCheck | undefined = task && destination !== undefined ? { branch: branchName, head: task.headChangeset, destination } : undefined;
  const { data: mergedInto } = useQuery({
    // The check last, whole: what `placeholderData` compares the previous one with.
    queryKey: queryKeys.inWorkspace(workspacePath, 'mergeTaskMergedInto', check),
    queryFn: () => api.merge.mergedInto(workspacePath, check!.head, check!.destination),
    enabled: check !== undefined && hasChangesets === true,
    // A request created or closed moves the destination: the step stays while the head is looked for there.
    placeholderData: (previous, previousQuery) =>
      check && keepsPreviousMergedCheck(previousQuery?.queryKey.at(-1) as MergedCheck | undefined, check) ? previous : undefined,
    // Keyed by the branch head too. A merge found stays found; "not merged yet" is asked again after operations and,
    // like other slow lists, every few minutes at most.
    ...SLOW_CHANGING_QUERY,
    staleTime: (query) => (query.state.data == null ? SLOW_CHANGING_QUERY.staleTime : Infinity),
  });
  const merged = useFinishedTasksStore((state) => state.merged[workspacePath]);
  const dismissed = useFinishedTasksStore((state) => state.dismissed);

  const finished = finishedTaskFor({ branch: branchName, destination, merged, mergedInto, dismissed });
  const step = taskNextStepOf({ branch: task, hasChangesets, mergedInto, reviewsOfBranch: reviews.data, finished });
  const toRead = conversationToRead(step);
  const { data: conversation } = useQuery({ ...reviewConversationQuery(place, toRead ?? 0), ...SLOW_CHANGING_QUERY, enabled: toRead !== undefined });
  const open = conversation && toRead !== undefined ? openItemsOfConversation(conversation.comments) : undefined;
  const view = taskNextStepView(step, { quiet, besideAnotherAction, open });

  if (step.kind === 'finished') return <FinishedTaskCard workspacePath={workspacePath} task={step.task} />;
  if (!task || (view.actions.length === 0 && !view.taskMerge)) return null;

  const run = (action: TaskNextStepAction): void => {
    switch (action.kind) {
      case 'create':
        openCreateMergeRequestDialog(place, task);
        return;
      case 'readyForReview':
        if ('request' in step) void setMergeRequestState(place, step.request, action.move);
        return;
      case 'open':
        if ('request' in step) openReview(step.request);
        return;
      case 'merge':
        openMergeRequestMerge(action.merge.request, action.merge.source);
        return;
    }
  };

  return (
    <div className={styles.nextStep} data-quiet={quiet}>
      {view.line && <RequestLine line={view.line} />}
      {view.actions.length > 0 && (
        <div className={styles.actions}>
          {view.actions.map((action) => (
            <Button
              key={action.kind}
              variant={action.primary ? 'primary' : quiet ? 'ghost' : 'secondary'}
              size={quiet ? 'small' : 'medium'}
              icon={ACTION_ICONS[action.kind]}
              onClick={() => run(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
      {view.taskMerge && (
        <TaskMergeButton
          source={view.taskMerge.source}
          destination={view.taskMerge.destination}
          tooltip={view.taskMerge.tip}
          quiet={quiet}
          subdued={view.taskMerge.subdued}
          onClick={() => openTaskMerge(task)}
        />
      )}
    </div>
  );
}

const ACTION_ICONS: Record<TaskNextStepAction['kind'], ReactNode> = {
  create: <GitPullRequestPlus size={13} />,
  readyForReview: <GitPullRequest size={13} />,
  merge: <GitMerge size={13} />,
  open: undefined,
};

/** "⟟ #12 Login screen · waiting for 2 reviewers": the title gives way first. */
function RequestLine({ line }: { line: TaskNextStepLine }) {
  return (
    <div className={styles.line} data-tip={line.tip}>
      <MergeRequestStateIcon mergeRequest={line.mergeRequest} tip={false} />
      <span className={styles.number}>{line.number}</span>
      <span className={styles.title}>{line.title}</span>
      <span className={styles.status}>· {line.status}</span>
    </div>
  );
}
