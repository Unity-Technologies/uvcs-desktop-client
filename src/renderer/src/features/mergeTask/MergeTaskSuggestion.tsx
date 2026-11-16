import { useQuery } from '@tanstack/react-query';
import { GitMerge, GitPullRequest } from 'lucide-react';
import type { ReactNode } from 'react';
import { workspacePlace } from '@shared/domain/place';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY, SLOW_CHANGING_QUERY } from '../../app/queryClient';
import { usePlace } from '../../app/workspace/useWorkspace';
import { GitPullRequestPlus } from '../../components/GitPullRequestPlus';
import { branchLabels } from '../../lib/branchLabels';
import { Button } from '../../ui/Button';
import { useBranch } from '../branches/useBranches';
import { branchReviewsQuery } from '../codeReviews/changeRequests/useChangeRequests';
import { openReview } from '../codeReviews/codeReviewOperations';
import { reviewConversationQuery } from '../codeReviews/conversation/useReviewConversation';
import { openCreateMergeRequestDialog } from '../codeReviews/CreateMergeRequestDialog';
import { openItemsOfConversation } from '../codeReviews/mergeCard';
import { setMergeRequestState } from '../codeReviews/mergeRequestOperations';
import { MERGE_REQUEST_STATE_ICONS } from '../codeReviews/mergeRequestState';
import stateColors from '../codeReviews/mergeRequestStateColors.module.css';
import { finishedTaskFor, useFinishedTasksStore } from './finishedTask';
import { FinishedTaskCard } from './FinishedTaskCard';
import { openMergeRequestMerge, openTaskMerge } from './mergeTaskOperations';
import { isTaskBranch } from './mergeTaskSummary';
import { TaskMergeButton } from './TaskMergeButton';
import { conversationToRead, mergedCheckDestinationOf, taskNextStepOf, taskNextStepView, type TaskNextStepAction, type TaskNextStepLine } from './taskNextStep';
import styles from './MergeTaskSuggestion.module.css';

/**
 * For a clean workspace on a task branch with changesets of its own, the task's next step (`taskNextStepOf`): create
 * its merge request, see where the request stands and move it on, merge it once reviewed; once merged, what to do
 * next. It stays cheap: one `cm find` reads the branch (never the list of every branch), one (limit 1) per branch head
 * tells whether the branch has changesets, and one merge link (limit 1) per head whether that head is already merged
 * where the task merges. The branch's reviews are the read Changes already makes (`branchReviewsQuery`, for the change
 * requests a check-in applies), and so is the conversation that counts a rework's change requests. The merge itself is
 * only previewed once its page opens. `quiet` where it sits under a list: the most useful action alone.
 */
export function MergeTaskSuggestion({ workspacePath, branchName, quiet = false }: { workspacePath: string; branchName: string; quiet?: boolean }) {
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
  const { data: mergedInto } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'mergeTaskMergedInto', branchName, task?.headChangeset, destination),
    queryFn: () => api.merge.mergedInto(workspacePath, task!.headChangeset, destination!),
    enabled: task !== undefined && destination !== undefined && hasChangesets === true,
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
  const view = taskNextStepView(step, { quiet, open });

  if (step.kind === 'finished') return <FinishedTaskCard workspacePath={workspacePath} task={step.task} />;
  if (!task || (view.actions.length === 0 && !view.mergesTask)) return null;

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

  const [source, parent] = branchLabels(task.name, task.parent);
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
      {view.mergesTask && (
        <TaskMergeButton
          source={source}
          destination={parent}
          tooltip={`Finish the task without a merge request: merge ${task.name} into ${task.parent}`}
          quiet={quiet}
          subdued={view.actions.length > 0}
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
  const StateIcon = MERGE_REQUEST_STATE_ICONS[line.state];
  return (
    <div className={styles.line} data-tip={`${line.tip}: ${line.title}`}>
      <span className={`${styles.state} ${stateColors.stateColor}`} data-state={line.state} aria-hidden>
        <StateIcon size={14} />
      </span>
      <span className={styles.number}>{line.number}</span>
      <span className={styles.title}>{line.title}</span>
      <span className={styles.status}>· {line.status}</span>
    </div>
  );
}
