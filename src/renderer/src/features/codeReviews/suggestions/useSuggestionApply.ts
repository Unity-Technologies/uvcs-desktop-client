import { useQuery } from '@tanstack/react-query';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import { workspacePlace } from '@shared/domain/place';
import { useWorkspaceInfoOf } from '../../../app/workspace/useWorkspace';
import { branchWorkedOn } from '../../../components/workingObject';
import { useChangeset } from '../../changesets/useChangeset';
import { contentQuery } from '../../diff/viewer/contentQueries';
import { useIncomingSummary } from '../../incoming/useIncomingSummary';
import { behindBranch } from '../../pendingChanges/checkinBehind';
import { usePendingChanges } from '../../pendingChanges/usePendingChanges';
import type { Read, SuggestedChange } from './suggestedChange';
import { reviewBranchOf, suggestionApplyOf, type SuggestionApply } from './suggestionApply';
import { useCommentedText } from './useReplacedLines';

/**
 * Whether a suggestion can be applied in the window's workspace (`suggestionApplyOf`), from what the window reads
 * anyway, so no suggestion costs the server a command: the workspace's info (`cm wi`, local) and the incoming check
 * (polled already), the review's branch (a changeset review's changeset, which its diff reads), the pending changes
 * (Changes' list, local), the revision the suggestion was written on (the block's own read), and the file on disk.
 */
export function useSuggestionApply(workspacePath: string, target: CodeReviewTarget, change: SuggestedChange, open: boolean): SuggestionApply {
  const info = useWorkspaceInfoOf(workspacePath);
  const workspaceBranch: Read<string | null> = info.isError ? 'failed' : info.data ? (branchWorkedOn(info.data.selector) ?? null) : 'reading';
  const changeset = useChangeset(target.kind === 'changeset' ? target.changesetId : null);
  const changesetBranch: Read<string> = changeset.isError ? 'failed' : (changeset.data?.branch ?? 'reading');
  const reviewBranch = reviewBranchOf(target, changesetBranch);
  const { data: summary } = useIncomingSummary();
  const branch = typeof workspaceBranch === 'string' && workspaceBranch !== 'reading' && workspaceBranch !== 'failed' ? workspaceBranch : undefined;
  const behind = behindBranch(summary, branch, false);
  const { data: pendingChanges } = usePendingChanges();
  const pending = pendingChanges?.changes.some((pendingChange) => pendingChange.path === change.path) ?? false;
  const commentedText = useCommentedText(change);
  // The file on disk: a free read, again whenever asked (`contentCaching`), and refreshed with the workspace's files.
  const file = useQuery({ ...contentQuery(workspacePlace(workspacePath), { kind: 'workspaceFile', path: change.path }), enabled: open, retry: false });
  const workspaceFile = file.isError ? 'failed' : (file.data ?? 'reading');
  return suggestionApplyOf(change, { open, workspacePath, workspaceBranch, reviewBranch, behind, commentedText, workspaceFile, pending });
}
