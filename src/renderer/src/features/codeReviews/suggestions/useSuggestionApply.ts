import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import { workspacePlace } from '@shared/domain/place';
import { useWorkspaceInfoOf } from '../../../app/workspace/useWorkspace';
import { branchWorkedOn } from '../../../components/workingObject';
import { useChangeset } from '../../changesets/useChangeset';
import { contentQuery } from '../../diff/viewer/contentQueries';
import { useIncomingSummary } from '../../incoming/useIncomingSummary';
import { behindBranch } from '../../pendingChanges/checkinBehind';
import { usePendingChanges } from '../../pendingChanges/usePendingChanges';
import { FAILED, READING, readValue, type Read, type SuggestedChange } from './suggestedChange';
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
  const workspaceBranch = readOf(info, (data) => branchWorkedOn(data.selector) ?? null);
  const changeset = useChangeset(target.kind === 'changeset' ? target.changesetId : null);
  const changesetBranch: Read<string> = changeset.isError ? FAILED : changeset.data ? readValue(changeset.data.branch) : READING;
  const { data: summary } = useIncomingSummary();
  const behind = behindBranch(summary, workspaceBranch.kind === 'read' ? (workspaceBranch.value ?? undefined) : undefined, false);
  const { data: pendingChanges } = usePendingChanges();
  const pending = pendingChanges?.changes.some((pendingChange) => pendingChange.path === change.path) ?? false;
  const commentedText = useCommentedText(change);
  // The file on disk: a free read, again whenever asked (`contentCaching`), and refreshed with the workspace's files.
  const file = useQuery({ ...contentQuery(workspacePlace(workspacePath), { kind: 'workspaceFile', path: change.path }), enabled: open, retry: false });
  const workspaceFile = readOf(file, (data) => data);
  // Following the lines into the file is a line diff of the whole file: once per change of what it reads, not per render.
  return useMemo(
    () => suggestionApplyOf(change, { open, workspacePath, workspaceBranch, reviewBranch: reviewBranchOf(target, changesetBranch), behind, commentedText, workspaceFile, pending }),
    [change, open, workspacePath, readKey(workspaceBranch), target, readKey(changesetBranch), behind?.count, commentedText, file.data, file.isError, pending],
  );
}

/** A query's answer as a `Read`, through `value`. */
function readOf<Data, T>(query: { isError: boolean; data: Data | undefined }, value: (data: Data) => T): Read<T> {
  if (query.isError) return FAILED;
  return query.data === undefined ? READING : readValue(value(query.data));
}

/** What a `Read` of a branch's name is, for a memo's keys: its kind, and its name. Never a file's text. */
function readKey(read: Read<string | null>): string {
  return read.kind === 'read' ? `read:${read.value}` : read.kind;
}
